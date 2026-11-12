import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import "./LogoutButton.css";

export default function LogoutButton() {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out failed:", err);
    }

    // Clear anything saved about the household.
    localStorage.removeItem("householdId");
    sessionStorage.clear();

    // replace: true removes this page from history, so Back can't return here.
    navigate("/login", { replace: true });
  }

  return (
    <button type="button" className="logout-btn" onClick={handleLogout}>
      Log Out
    </button>
  );
}