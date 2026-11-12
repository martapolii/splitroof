import { NavLink } from "react-router-dom";
import "./Header.css";

// Iteration 1 pages only. Budgets, Settle Up and settlement history come in Iteration 2.
const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/expenses/new", label: "Add Expense" },
  { to: "/balances", label: "Balances" },
  { to: "/owed", label: "Who Owes Me" },
  { to: "/household", label: "Household" },
];

export default function Header() {
  return (
    <header className="header">
      <div className="container">
        <nav className="nav-links">
          <NavLink to="/dashboard" className="logo">
            SplitRoof
          </NavLink>

          {links.map((link) => (
            <NavLink key={link.to} to={link.to}>
              {link.label}
            </NavLink>
          ))}
          {/* Log Out button goes here (HM16) */}
        </nav>
      </div>
    </header>
  );
}
