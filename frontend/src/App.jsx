import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Header from "./components/Header";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import AddExpense from "./pages/AddExpense";
import Balances from "./pages/Balances";
import WhoOwesMe from "./pages/WhoOwesMe";
import Household from "./pages/Household";

// Pages inside the app need a signed in user. Anyone else goes to the sign in page (HM1).
function RequireAuth() {
  // undefined while Firebase is still checking, null when signed out
  const [user, setUser] = useState(auth ? undefined : null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (user === undefined) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Pages inside the app show the header. Sign in and sign up don't.
function MainLayout() {
  return (
    <>
      <Header />
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      <Route element={<RequireAuth />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/expenses/new" element={<AddExpense />} />
          <Route path="/balances" element={<Balances />} />
          <Route path="/owed" element={<WhoOwesMe />} />
          <Route path="/household" element={<Household />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
