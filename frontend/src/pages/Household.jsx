import InviteCodeSection from "../components/InviteCodeSection";

export default function Household() {
  // TEMP: the id comes from the create response until #93 (current household) is in.
  const householdId = localStorage.getItem("householdId");

  return (
    <>
      <h1>Household</h1>
      <p className="muted">
        Create a household, generate an invite code and join with a code go here (HA1, HA2, HM4).
      </p>

      {householdId && <InviteCodeSection householdId={householdId} />}
    </>
  );
}