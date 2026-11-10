import { Link } from "react-router-dom";

export default function Login() {
  return (
    <main className="page auth-page">
      <h1>Sign In</h1>
      <p className="muted">The sign in form goes here (HM1).</p>
      <p>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </main>
  );
}
