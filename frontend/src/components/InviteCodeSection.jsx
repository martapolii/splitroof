import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import "./InviteCodeSection.css";

export default function InviteCodeSection({ householdId }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // When the page opens, show the existing code so the admin can view it again.
  useEffect(() => {
    let cancelled = false;

    async function loadCode() {
      try {
        const data = await apiFetch(`/api/households/${householdId}/invite-code`);
        if (!cancelled) setCode(data.inviteCode || "");
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
  }, [householdId]);

  async function handleGenerate() {
    setError("");
    setMessage("");
    setWorking(true);
    try {
      const data = await apiFetch(`/api/households/${householdId}/invite-code`, {
        method: "POST",
      });
      setCode(data.inviteCode);
      setMessage("Invite code generated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

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
        <p>No invite code yet.</p>
      )}

      {!code && (
        <button type="button" onClick={handleGenerate} disabled={working}>
          {working ? "Generating..." : "Generate Code"}
        </button>
      )}

      {message && <p role="status" className="success-text">{message}</p>}
      {error && <p role="alert" className="error-text">{error}</p>}
    </section>
  );
}