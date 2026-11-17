import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import "./Header.css";
import LogoutButton from "./LogoutButton";

// Iteration 1 pages only. Budgets, Settle Up and settlement history come in Iteration 2.
const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/expenses/new", label: "Add Expense" },
  { to: "/balances", label: "Balances" },
  { to: "/owed", label: "Who Owes Me" },
  { to: "/household", label: "Household" },
];

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 1);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("menu-active", menuOpen);
    return () => document.body.classList.remove("menu-active");
  }, [menuOpen]);

  return (
    <header className={`header${isScrolled ? " scroll-active" : ""}`}>
      <div className="container">
        <nav className="nav-links">
          <NavLink to="/dashboard" className="logo">
            SplitRoof
          </NavLink>

          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className="desktop-only">
              {link.label}
            </NavLink>
          ))}

          <LogoutButton className="desktop-only" />

          <button
            type="button"
            className={`icon-hamburger trigger-menu${menuOpen ? " menu-active" : ""}`}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
          </button>
        </nav>
      </div>

      <div className={`site-responsive-menu${menuOpen ? " menu-active" : ""}`}>
        <nav className="nav-links">
          {links.map((link) => (
            <div className="link-wrap" key={link.to}>
              <NavLink to={link.to}>{link.label}</NavLink>
            </div>
          ))}
          <div className="link-wrap">
            <LogoutButton />
          </div>
        </nav>
      </div>
    </header>
  );
}