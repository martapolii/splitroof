import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import "./RecentExpenses.css";

function formatMoney(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

// refreshKey: when this number changes, the list reloads.
export default function RecentExpenses({ householdId, refreshKey = 0 }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await apiFetch(`/api/households/${householdId}/expenses?limit=10`);
        if (!cancelled) setExpenses(data.expenses || []);
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
                  {e.category} | paid by {e.payerName} | {e.date}
                </div>
              </div>
              <span className="expense-amount">{formatMoney(e.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}