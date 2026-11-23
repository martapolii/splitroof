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