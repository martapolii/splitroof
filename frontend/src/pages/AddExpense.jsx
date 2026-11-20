import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import ExpenseForm from "../components/ExpenseForm";

export default function AddExpense() {
  useEffect(() => {
    AOS.init();
  }, []);

  return (
    <div className="App">
      <div className="App-body">
        <div className="dotted-bg" aria-hidden="true" />
        <div className="container" data-aos="zoom-in-up">
          <h1>Add an Expense</h1>
          <ExpenseForm />
        </div>
      </div>
    </div>
  );
}