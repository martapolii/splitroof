import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HouseholdAPI } from "../api";

function formatMoney(cents) {
  const safeCents = Number.isFinite(cents) ? cents : 0;
  const dollars = (Math.abs(safeCents) / 100).toFixed(2);
  if (safeCents > 0) return `+$${dollars}`;
  if (safeCents < 0) return `-$${dollars}`;
  return `$${dollars}`;
}

function formatAmount(cents) {
  const safeCents = Number.isFinite(cents) ? cents : 0;
  return `$${(Math.abs(safeCents) / 100).toFixed(2)}`;
}

export default function Balances() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [household, setHousehold] = useState(null);
  const [balances, setBalances] = useState([]);
  const [debts, setDebts] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadBalances() {
      setLoading(true);
      setError("");
      try {
        const currentData = await HouseholdAPI.current();
        if (!active) return;

        if (!currentData?.household?.id) {
          setHousehold(null);
          setBalances([]);
          setDebts([]);
          return;
        }

        const householdId = currentData.household.id;
        setHousehold(currentData.household);

        const [balanceRows, debtData] = await Promise.all([
          HouseholdAPI.balances(householdId),
          HouseholdAPI.debts(householdId),
        ]);
        if (!active) return;

        const nameById = new Map(
          (currentData.members || []).map((member) => [
            member.uid,
            member.username || member.uid,
          ])
        );

        const enrichedBalances = (Array.isArray(balanceRows) ? balanceRows : []).map(
          (row) => ({
            userId: row.userId,
            username: nameById.get(row.userId) || row.userId,
            balanceCents: row.balanceCents ?? 0,
          })
        );

        setBalances(enrichedBalances);
        setDebts(Array.isArray(debtData?.debts) ? debtData.debts : []);
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Failed to load household balances.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadBalances();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="container">
      <h1>Household Balances</h1>

      {loading && <p className="muted">Loading balances...</p>}

      {!loading && error && (
        <p className="info-box error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && !household && (
        <div>
          <p className="muted">You are not in a household yet.</p>
          <Link to="/household">Go to Household</Link>
        </div>
      )}

      {!loading && !error && household && (
        <>
          <p className="muted">{household.name}</p>

          <section aria-labelledby="member-balances-heading">
            <h2 id="member-balances-heading">Member Running Balances</h2>
            {balances.length === 0 ? (
              <p className="muted">No member balances available yet.</p>
            ) : (
              <ul>
                {balances.map((member) => (
                  <li key={member.userId}>
                    <span>{member.username}</span>{" "}
                    <strong>{formatMoney(member.balanceCents)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="who-owes-whom-heading">
            <h2 id="who-owes-whom-heading">Who Owes Whom</h2>
            {debts.length === 0 ? (
              <p className="muted">All settled up—no outstanding balances between members.</p>
            ) : (
              <ul>
                {debts.map((debt, index) => (
                  <li
                    key={`${debt.fromUserId}-${debt.toUserId}-${index}`}
                  >
                    <span>
                      {debt.fromUsername || debt.fromUserId} owes{" "}
                      {debt.toUsername || debt.toUserId}
                    </span>{" "}
                    <strong>{formatAmount(debt.amountCents)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}