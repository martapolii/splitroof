import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import "./RecentExpenses.css";

function formatMoney(cents) {
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

// refreshKey: when this number changes, the list reloads.
export default function RecentExpenses({ householdId, refreshKey = 0 }) {
  const [expenses, setExpenses] = useState([]);
  const [usernames, setUsernames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!householdId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [expenseList, members] = await Promise.all([
          apiFetch(`/api/households/${householdId}/expenses`),
          apiFetch(`/api/households/${householdId}/members`),
        ]);
        if (cancelled) return;

        // payerId is a user id, so look the username up from the members list.
        const names = {};
        (Array.isArray(members) ? members : []).forEach((m) => {
          names[m.uid] = m.username || "Unknown";
        });

        setUsernames(names);
        // The server returns up to 50 expenses, newest first by date. Show them all,
        // cutting to the first 10 left out an expense saved with a past date.
        setExpenses(Array.isArray(expenseList) ? expenseList : []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [householdId, refreshKey]);

  if (loading) return <p>Loading recent expenses...</p>;
  if (error) return <p role="alert" className="recent-error">{error}</p>;

  return (
    <section className="recent-expenses">
      <h2>Recent Expenses</h2>

      {expenses.length === 0 ? (
        <p>No expenses yet. Add your first one above.</p>
      ) : (
        <ul className="expense-list">
          {expenses.map((e) => (
            <li key={e.id} className="expense-item">
              <div>
                <strong>{e.description}</strong>
                <div className="expense-meta">
                  {e.category} | paid by {usernames[e.payerId] || "Unknown"} | {e.date}
                </div>
              </div>
              <span className="expense-amount">{formatMoney(e.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}