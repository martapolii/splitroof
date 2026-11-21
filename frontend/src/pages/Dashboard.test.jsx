import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import { HouseholdAPI } from "../api.js";

// No real API in tests
jest.mock("../api.js", () => ({ HouseholdAPI: { current: jest.fn() } }));
jest.mock("aos", () => ({ init: jest.fn() }));
// the hero animation needs matchMedia, which jsdom does not have
jest.mock("../components/Hero.jsx", () => () => null);

const household = {
  user: { uid: "alex", username: "Alex" },
  household: { id: "houseA", name: "Apartment A", adminId: "alex", memberIds: ["alex", "sam"], inviteCode: "AAAAAAAA" },
  members: [{ uid: "alex", username: "Alex" }, { uid: "sam", username: "Sam" }],
  month: "2026-11",
};

// HM3 test 1: this month's total and the user's balance come from /current (#93)
test("shows the spending and balance from the backend", async () => {
  HouseholdAPI.current.mockResolvedValue({ ...household, spentCents: 4000, balanceCents: -2334 });
  render(<Dashboard />, { wrapper: MemoryRouter });

  expect((await screen.findAllByText("$40.00")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("-$23.34").length).toBeGreaterThan(0);
  expect(screen.getByText("The report by category and member goes here (HM3).")).toBeInTheDocument();
  expect(screen.queryByText("No expenses recorded this month.")).not.toBeInTheDocument();
});

// a balance from an older month still shows when nothing was spent this month
test("shows an older balance with no spending this month", async () => {
  HouseholdAPI.current.mockResolvedValue({ ...household, spentCents: 0, balanceCents: 4000 });
  render(<Dashboard />, { wrapper: MemoryRouter });

  expect(await screen.findByText("No expenses recorded this month.")).toBeInTheDocument();
  expect(screen.getAllByText("+$40.00").length).toBeGreaterThan(0);
});

// HM3 test 2: a user with no household is asked to create or join one (#140)
test("asks a user with no household to create or join one", async () => {
  HouseholdAPI.current.mockResolvedValue({
    user: { uid: "pat", username: "pat" },
    household: null,
    members: [],
  });

  render(<Dashboard />, { wrapper: MemoryRouter });

expect(
  await screen.findByRole("link", { name: "Create or Join a Household" })
).toHaveAttribute("href", "/household");
});
