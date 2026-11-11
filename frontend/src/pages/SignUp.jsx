import { Link } from "react-router-dom";

export default function SignUp() {
  return (
    <main className="page auth-page">
      <h1>Sign Up</h1>
      <p className="muted">The sign up form goes here (HM2).</p>
      <p>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </main>
  );
}
