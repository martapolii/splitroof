import { useEffect, useState } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import { HouseholdAPI } from "../api";
import CreateHouseholdForm from "../components/CreateHouseholdForm";
import JoinHouseholdForm from "../components/JoinHouseholdForm";
import InviteCodeSection from "../components/InviteCodeSection";

export default function Household() {
  const [householdId, setHouseholdId] = useState("");

  const handleCreated = (result) => {
    if (result?.id) {
      setHouseholdId(result.id);
    }
  };

  useEffect(() => {
    AOS.init();
  }, []);

  // The invite code is for the household the user is in now. Ask the API for it,
  // so the code still shows after logging out and back in (HA2 test 2).
  useEffect(() => {
    let cancelled = false;

    async function loadHousehold() {
      try {
        const data = await HouseholdAPI.current();
        // Keep a household that was just created on this page while this was loading
        if (!cancelled && data?.household?.id) setHouseholdId((id) => id || data.household.id);
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
