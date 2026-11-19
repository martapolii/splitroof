import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import "./InviteCodeSection.css";

export default function InviteCodeSection({ householdId, initialCode = "" }) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(!initialCode);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // The back end creates the code with the household, so we only read it.
  useEffect(() => {
    if (!householdId || initialCode) return;

    let cancelled = false;

    async function loadCode() {
      try {
        const data = await apiFetch(`/api/households/${householdId}`);
        const found = data.inviteCode ?? data.household?.inviteCode ?? "";
        if (!cancelled) setCode(found);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCode();
    return () => {
      cancelled = true;
    };
  }, [householdId, initialCode]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setMessage("Code copied to clipboard!");
    } catch {
      setError("Could not copy. Please select the code and copy it manually.");
    }
  }

  if (loading) return <p>Loading invite code...</p>;

  return (
    <section className="invite-section">
      <h2>Invite Code</h2>
      <p>Share this code with your housemates so they can join.</p>

      {code ? (
        <div className="invite-code-row">
          <span className="invite-code">{code}</span>
          <button type="button" onClick={handleCopy}>Copy</button>
        </div>
      ) : (
        <p>No invite code found for this household.</p>
      )}

      {message && <p role="status" className="success-text">{message}</p>}
      {error && <p role="alert" className="error-text">{error}</p>}
    </section>
  );
}