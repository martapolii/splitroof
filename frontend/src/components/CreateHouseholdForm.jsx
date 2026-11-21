import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HouseholdAPI } from "../api.js";

export default function CreateHouseholdForm({ onCreated }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a household name.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await HouseholdAPI.create(trimmed);
      const householdObj = data?.household || data;
      const householdId =
        householdObj?.id || householdObj?._id || data?.householdId || "";
      const householdName = householdObj?.name || trimmed;

      if (householdId) {
        localStorage.setItem("householdId", householdId);
      }

      const result = { id: householdId, name: householdName };
      setCreated(result);
      onCreated?.(result);
    } catch (err) {
      setError(err.message || "Could not create household.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoToDashboard = () => {
    navigate("/dashboard", {
      state: {
        createdHousehold: created,
      },
    });
  };

  return (
    <section className="create-household-section" aria-label="Create household">
      <h2>Create a Household</h2>

      {!created ? (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="household-name">Household name</label>
            <input
              id="household-name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Apartment 4B"
              disabled={submitting}
              required
            />
          </div>

          {error && (
            <p className="info-box error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Household"}
          </button>
        </form>
      ) : (
        <div className="household-created">
          <p>
            <strong>{created.name}</strong> has been created.
          </p>
          <p>
            Role: <strong>Household Admin</strong>
          </p>
          <div className="household-actions flex gap-12">
            <Link to="/household" className="btn-link">
              View / Generate Invite Code
            </Link>
            <button type="button" onClick={handleGoToDashboard}>
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </section>
  );
}