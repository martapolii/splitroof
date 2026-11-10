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
    <header className="site-header">
      <NavLink to="/dashboard" className="logo">
        SplitRoof
      </NavLink>

      <nav>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className="nav-link">
            {link.label}
          </NavLink>
        ))}
        {/* Log Out button goes here (HM16) */}
      </nav>
    </header>
  );
}
