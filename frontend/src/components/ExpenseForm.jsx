import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, HouseholdAPI } from "../api.js";
import { auth } from "../firebase.js";
import { DEFAULT_CATEGORIES } from "../categories.js";
import {
  dollarsToCents,
  formatCents,
  prefillPercents,
  readPercent,
  readShareCents,
  sanitizeMoney,
  sanitizePercent,
  todayDateInput,
} from "../utils/expenseSplit.js";
import "./ExpenseForm.css";

const SPLIT_HINTS = {
  equal: "Everyone in the split pays the same. An extra cent goes to the person who paid.",
  amount: "Enter what each person pays. The shares have to add up to the total.",
  percent: "Enter each person's percent. The percentages have to add up to 100.",
};

function memberBaseName(member) {
  const name = typeof member.username === "string" ? member.username.trim() : "";
  return name || "Member";
}

// Two people with no username would both read "Member" in the payer list.
function memberLabels(members) {
  const bases = members.map(memberBaseName);
  const totals = new Map();
  for (const base of bases) totals.set(base, (totals.get(base) || 0) + 1);
  const seen = new Map();
  return bases.map((base) => {
    if (totals.get(base) === 1) return base;
    const next = (seen.get(base) || 0) + 1;
    seen.set(base, next);
    return `${base} ${next}`;
  });
}

export default function ExpenseForm({ onSaved }) { // #68: added { onSaved }
  const [householdId, setHouseholdId] = useState("");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayDateInput);
  const [payerId, setPayerId] = useState("");
  const [category, setCategory] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [splitMode, setSplitMode] = useState("equal");
  const [amountShares, setAmountShares] = useState({});
  const [percentShares, setPercentShares] = useState({});
  const [formError, setFormError] = useState("");
  const [showRequired, setShowRequired] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const sharesTouched = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadHousehold() {
      try {
        const current = await HouseholdAPI.current();
        if (cancelled) return;

        const household = current?.household;
        const list = Array.isArray(current?.members) ? current.members : [];
        if (!household?.id || list.length === 0) {
          setLoadError("You are not in a household");
          setLoading(false);
          return;
        }

        const uid = auth?.currentUser?.uid;
        setHouseholdId(household.id);
        setMembers(list);
        setPayerId(list.some((member) => member.uid === uid) ? uid : list[0].uid);
        setSelectedIds(list.map((member) => member.uid));
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || "Could not load this household.");
        setLoading(false);
      }
    }

    loadHousehold();
    return () => {
      cancelled = true;
    };
  }, []);

  const amountCents = dollarsToCents(amount);
  const shownPercents = sharesTouched.current
    ? percentShares
    : prefillPercents(selectedIds, payerId);

  let splitError = "";
  let runningLabel = "";

  if (selectedIds.length === 0) {
    splitError = "Choose at least one person to split this with.";
  } else if (splitMode === "equal" && amountCents) {
    runningLabel = `Split equally. Total ${formatCents(amountCents)}.`;
  } else if (splitMode === "amount" && amountCents) {
    const parsed = selectedIds.map((id) => readShareCents(amountShares[id]));
    if (parsed.some((cents) => cents === null)) {
      splitError = "Enter each share in dollars and cents.";
    } else {
      const sum = parsed.reduce((total, cents) => total + cents, 0);
      runningLabel = `Assigned ${formatCents(sum)} of ${formatCents(amountCents)}.`;
      if (sum !== amountCents) {
        splitError = `The shares add up to ${formatCents(sum)}, not ${formatCents(amountCents)}.`;
      }
    }
  } else if (splitMode === "percent") {
    const parsed = selectedIds.map((id) => readPercent(shownPercents[id]));
    if (parsed.some((percent) => percent === null)) {
      splitError = "Enter each share as a whole percent.";
    } else {
      const sum = parsed.reduce((total, percent) => total + percent, 0);
      runningLabel = `Assigned ${sum}% of 100%.`;
      if (sum !== 100) {
        splitError = `The percentages add up to ${sum}%, not 100%.`;
      }
    }
  }

  function clearStatus() {
    setFormError("");
    setSavedMessage("");
  }

  function changeMode(mode) {
    sharesTouched.current = false;
    setSplitMode(mode);
    clearStatus();
  }

  function toggleMember(uid) {
    setSelectedIds((current) => {
      const next = current.includes(uid)
        ? current.filter((id) => id !== uid)
        : [...current, uid];
      return members.map((member) => member.uid).filter((id) => next.includes(id));
    });
    clearStatus();
  }

  function updateAmountShare(uid, value) {
    setAmountShares((current) => ({ ...current, [uid]: sanitizeMoney(value) }));
    clearStatus();
  }

  function updatePercentShare(uid, value) {
    const base = sharesTouched.current
      ? percentShares
      : prefillPercents(selectedIds, payerId);
    sharesTouched.current = true;
    setPercentShares({ ...base, [uid]: sanitizePercent(value) });
    clearStatus();
  }

  const missingAmount = amountCents === null || amountCents < 1;
  const missingDescription = !description.trim();
  const missingDate = !date;
  const missingPayer = !payerId;
  const missingCategory = !category;
  const missingMembers = selectedIds.length === 0;
  const invalid = (missing) => showRequired && missing;

  async function handleSubmit(event) {
    event.preventDefault();
    setSavedMessage("");

    if (missingAmount || missingDescription || missingDate || missingPayer || missingCategory || missingMembers) {
      setShowRequired(true);
      setFormError("Fill in the highlighted fields.");
      return;
    }

    setFormError("");
    if (splitError) return;

    const body = {
      amountCents,
      description: description.trim(),
      date,
      payerId,
      category,
      split: splitMode === "equal" ? "equal" : "custom",
    };

    if (splitMode === "equal") {
      body.memberIds = selectedIds;
    } else if (splitMode === "amount") {
      body.shares = selectedIds.map((uid) => ({
        userId: uid,
        amountCents: readShareCents(amountShares[uid]),
      }));
    } else {
      body.shares = selectedIds.map((uid) => ({
        userId: uid,
        percent: readPercent(shownPercents[uid]),
      }));
    }

    setSaving(true);
    try {
      await apiFetch(`/api/households/${householdId}/expenses`, {
        method: "POST",
        body,
      });
      setSavedMessage("Saved. This expense is in the household expense list.");
      setShowRequired(false);
      setAmount("");
      setDescription("");
      sharesTouched.current = false;
      setSplitMode("equal");
      setAmountShares({});
      setPercentShares({});
      onSaved?.(); // #68: tell the page to reload the recent expenses
    } catch (err) {
      setFormError(err.message || "Could not save this expense.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="form-container expense-form">
        <p>Loading household…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="form-container expense-form">
        <p className="info-box error" role="alert">
          {loadError}
        </p>
        <p>
          <Link to="/household">Go to Household</Link>
        </p>
      </div>
    );
  }

  const labels = memberLabels(members);

  return (
    <form className="form-container expense-form" aria-label="Add an expense" onSubmit={handleSubmit} noValidate>
      {savedMessage && (
        <p className="info-box" role="status">
          {savedMessage}
        </p>
      )}
      {formError && (
        <p className="info-box error" role="alert">
          {formError}
        </p>
      )}

      <div className="form-group">
        <label htmlFor="expense-amount">Amount</label>
        <div className={`money-input${invalid(missingAmount) ? " is-invalid" : ""}`}>
          <span aria-hidden="true">$</span>
          <input
            id="expense-amount"
            aria-invalid={invalid(missingAmount)}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(sanitizeMoney(event.target.value));
              clearStatus();
            }}
            placeholder="0.00"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="expense-description">Description</label>
        <input
          id="expense-description"
          className={invalid(missingDescription) ? "is-invalid" : undefined}
          aria-invalid={invalid(missingDescription)}
          type="text"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            clearStatus();
          }}
          placeholder="What was this for?"
          maxLength={200}
          autoComplete="off"
        />
      </div>

      <div className="form-group">
        <label htmlFor="expense-date">Date</label>
        <input
          id="expense-date"
          className={invalid(missingDate) ? "is-invalid" : undefined}
          aria-invalid={invalid(missingDate)}
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            clearStatus();
          }}
        />
        <p className="field-hint">Past dates are allowed.</p>
      </div>

      <div className="form-group">
        <label htmlFor="expense-payer">Who paid</label>
        <select
          id="expense-payer"
          className={invalid(missingPayer) ? "is-invalid" : undefined}
          aria-invalid={invalid(missingPayer)}
          value={payerId}
          onChange={(event) => {
            setPayerId(event.target.value);
            clearStatus();
          }}
        >
          {members.map((member, index) => (
            <option key={member.uid} value={member.uid}>
              {labels[index]}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="expense-category">Category</label>
        <select
          id="expense-category"
          className={invalid(missingCategory) ? "is-invalid" : undefined}
          aria-invalid={invalid(missingCategory)}
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            clearStatus();
          }}
        >
          <option value="">Select a category</option>
          {DEFAULT_CATEGORIES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <span className="field-label">How to split</span>
        <div className="expense-split-options">
          <button type="button" className="expense-chip" aria-pressed={splitMode === "equal"} onClick={() => changeMode("equal")}>
            Equal split
          </button>
          <button type="button" className="expense-chip" aria-pressed={splitMode === "amount"} onClick={() => changeMode("amount")}>
            Custom amounts
          </button>
          <button type="button" className="expense-chip" aria-pressed={splitMode === "percent"} onClick={() => changeMode("percent")}>
            Percentages
          </button>
        </div>
        <p className="field-hint">{SPLIT_HINTS[splitMode]}</p>

        <fieldset className={`split-members${invalid(missingMembers) ? " is-invalid" : ""}`}>
          <legend>Split between</legend>
          {members.map((member, index) => {
            const name = labels[index];
            const included = selectedIds.includes(member.uid);
            return (
              <div key={member.uid} className="expense-split-row">
                <label className="split-member">
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={() => toggleMember(member.uid)}
                    aria-label={`Include ${name} in the split`}
                  />
                  <span className="split-toggle" aria-hidden="true" />
                  <span className="split-member-name">{name}</span>
                </label>
                {included && splitMode === "amount" ? (
                  <div className="share-entry">
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`${name}'s amount`}
                      value={amountShares[member.uid] ?? ""}
                      onChange={(event) => updateAmountShare(member.uid, event.target.value)}
                    />
                  </div>
                ) : null}
                {included && splitMode === "percent" ? (
                  <div className="share-entry">
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={`${name}'s percent`}
                      value={shownPercents[member.uid] ?? ""}
                      onChange={(event) => updatePercentShare(member.uid, event.target.value)}
                    />
                    <span aria-hidden="true">%</span>
                  </div>
                ) : null}
                {member.uid === payerId ? <span className="paid-tag">Paid</span> : <span className="paid-tag" aria-hidden="true" />}
              </div>
            );
          })}
        </fieldset>

        {runningLabel && <p className="expense-running-total">{runningLabel}</p>}
        {splitError && (
          <p className="info-box error" role="alert">
            {splitError}
          </p>
        )}
      </div>

      <button className="frontend-button" type="submit" disabled={saving || Boolean(splitError)}>
        {saving ? "Saving..." : "Save expense"}
      </button>
    </form>
  );
}