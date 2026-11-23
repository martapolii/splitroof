import { render, screen } from "@testing-library/react";
import RecentExpenses from "./RecentExpenses";
import { apiFetch } from "../api";

jest.mock("../api", () => ({ apiFetch: jest.fn() }));

test("shows every expense the API returns, including one saved with a past date", async () => {
  // 12 expenses dated today, then one with a past date (the API sorts by date)
  const expenses = [];
  for (let i = 1; i <= 12; i++) {
    expenses.push({ id: `e${i}`, description: `Expense ${i}`, category: "Other", payerId: "alex", date: "2026-11-23", amountCents: 100 * i });
  }
  expenses.push({ id: "old", description: "Old bill", category: "Household", payerId: "alex", date: "2026-11-01", amountCents: 750 });

  apiFetch.mockImplementation((path) =>
    Promise.resolve(path.endsWith("/members") ? [{ uid: "alex", username: "Alex" }] : expenses)
  );

  render(<RecentExpenses householdId="houseA" />);

  expect(await screen.findByText("Old bill")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(13);
  expect(screen.getByText("$7.50")).toBeInTheDocument();
});
