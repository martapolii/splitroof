import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import ExpenseForm from "../components/ExpenseForm";
import Hero from "../components/Hero";
import "./AddExpense.css";

export default function AddExpense() {
  useEffect(() => {
    AOS.init();
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
          <ExpenseForm />
        </div>

      </div>
    </div>
  );
}