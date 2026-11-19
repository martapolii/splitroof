import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api.js";

export default function InviteForm() {
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const code = inviteCode.trim();
    if (!code) {
      setError("Invite code is required");
      return;
    }

    setIsLoading(true);
    try {
      await apiFetch("/api/households/join", {
        method: "POST",
        body: { inviteCode: code },
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Could not join this household.");
      setIsLoading(false);
    }
  }

  return (
    <form className="form-container" onSubmit={handleSubmit}>
      <h2>Join with a code</h2>

      {error && (
        <p className="info-box error" role="alert">
          {error}
        </p>
      )}

      <div className="form-group">
        <label htmlFor="invite-code">Invite code</label>
        <input
          id="invite-code"
          type="text"
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value)}
          placeholder="Enter invite code"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>

      <button className="frontend-button" type="submit" disabled={isLoading}>
        {isLoading ? "Joining..." : "Join household"}
      </button>
    </form>
  );
}