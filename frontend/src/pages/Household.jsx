import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import JoinHouseholdForm from "../components/JoinHouseholdForm";
import InviteCodeSection from "../components/InviteCodeSection";

export default function Household() {
  // TEMP: the id comes from the create response until #93 (current household) is in.
  const householdId = localStorage.getItem("householdId");

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
          {householdId && <InviteCodeSection householdId={householdId} />}
        </div>
      </div>
    </div>
  );
}
