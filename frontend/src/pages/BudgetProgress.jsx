import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import CategoryProgress from "../components/CategoryProgress";
import "./BudgetProgress.css";

export default function BudgetProgress() {
  // CHECK: ask the team how the app stores the current household ID.
  const householdId = localStorage.getItem("householdId");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await apiFetch(`/api/households/${householdId}/budget-progress`);
        if (!cancelled) setData(result);
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
  }, [householdId]);

  if (loading) return <p>Loading budget progress...</p>;
  if (error) return <p role="alert" className="budget-error">{error}</p>;
  if (!data) return null;

  return (
    <div className="budget-progress-page">
      <h1>Budget Progress</h1>
      <p>Month: {data.month}</p>

      <div className="progress-grid">
        {data.categories.map((c) => (
          <CategoryProgress key={c.category} {...c} />
        ))}
      </div>
    </div>
  );
}