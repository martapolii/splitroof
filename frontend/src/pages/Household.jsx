import { useEffect, useState } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import CreateHouseholdForm from "../components/CreateHouseholdForm";
import JoinHouseholdForm from "../components/JoinHouseholdForm";
import InviteCodeSection from "../components/InviteCodeSection";

export default function Household() {
const [householdId, setHouseholdId] = useState(
  () => localStorage.getItem("householdId") || ""
);

const handleCreated = (result) => {
  if (result?.id) {
    setHouseholdId(result.id);
  }
};
  useEffect(() => {
    AOS.init();
  }, []);

  return (
    <div className="App">
      <div className="App-body">
        <div className="dotted-bg" aria-hidden="true" />
        <div className='container container-2' data-aos="zoom-in-up">
          <h1>Household</h1>
           <CreateHouseholdForm onCreated={handleCreated} />
          <JoinHouseholdForm />
          {householdId && <InviteCodeSection householdId={householdId} />}
        </div>
      </div>
    </div>
  );
}
