import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import JoinHouseholdForm from "../components/JoinHouseholdForm";

export default function Household() {
  useEffect(() => {
    AOS.init();
  }, []);

  return (
    <div className="App">
      <div className="App-body">
        <div className="dotted-bg" aria-hidden="true" />
        <div className='container container-2' data-aos="zoom-in-up">
          <h1>Household</h1>
          <JoinHouseholdForm />
        </div>
      </div>
    </div>
  );
}