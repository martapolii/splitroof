import { useEffect, useState } from "react"; // #68: added useState
import AOS from "aos";
import "aos/dist/aos.css";
import { apiFetch } from "../api"; // #68
import ExpenseForm from "../components/ExpenseForm";
import Hero from "../components/Hero";
import RecentExpenses from "../components/RecentExpenses"; // #68
import "./AddExpense.css";

export default function AddExpense() {
  // #68: current household id and a counter that reloads the list after a save
  const [householdId, setHouseholdId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    AOS.init();
  }, []);

  // #68: get the signed-in user's current household (household is null if none)
  useEffect(() => {
    let cancelled = false;

    async function loadHousehold() {
      try {
        const data = await apiFetch("/api/households/current");
        if (!cancelled) setHouseholdId(data.household?.id || "");
      } catch (err) {
        console.error("Could not load the current household:", err);
      }
    }

    loadHousehold();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="App">
      <div className="App-body expense">
        <div className="dotted-bg" aria-hidden="true" />

        <div className="container" data-aos="zoom-in-up">
          <Hero
            phrases={['Split expenses', 'Track bills', 'Fair shares']}
            eyebrow="Add an Expense"
            fixedLine="Add an Expense"
            label="Add an Expense"
            subtext="Add an expense to your household."
            sectionLabel="Add an Expense"
          />
        </div>

        <div className="container container-2" data-aos="zoom-in-up">
          {/* #68: onSaved tells this page to reload the recent expenses */}
          <ExpenseForm onSaved={() => setRefreshKey((k) => k + 1)} />
        </div>

        {/* #68: recent expenses list */}
        {householdId && (
          <div className="container container-2" data-aos="zoom-in-up">
            <RecentExpenses householdId={householdId} refreshKey={refreshKey} />
          </div>
        )}
      </div>
    </div>
  );
}