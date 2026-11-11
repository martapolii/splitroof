import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import AddExpense from "./pages/AddExpense";
import Balances from "./pages/Balances";
import WhoOwesMe from "./pages/WhoOwesMe";
import Household from "./pages/Household";

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

      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/expenses/new" element={<AddExpense />} />
        <Route path="/balances" element={<Balances />} />
        <Route path="/owed" element={<WhoOwesMe />} />
        <Route path="/household" element={<Household />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
