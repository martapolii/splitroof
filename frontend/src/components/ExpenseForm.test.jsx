import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ExpenseForm from "./ExpenseForm";
import { apiFetch, HouseholdAPI } from "../api.js";

jest.mock("../api.js", () => ({ apiFetch: jest.fn(), HouseholdAPI: { current: jest.fn() } }));
jest.mock("../firebase.js", () => ({ auth: { currentUser: { uid: "alex" } } }));

test("sends the entered percentages to the expense API when they total 100", async () => {
  const user = userEvent.setup();
  HouseholdAPI.current.mockResolvedValue({
    household: { id: "houseA" },
    members: [{ uid: "alex", username: "Alex" }, { uid: "sam", username: "Sam" }],
  });
  apiFetch.mockResolvedValue({ id: "expense1" });
  render(<ExpenseForm />, { wrapper: MemoryRouter });
  await user.type(await screen.findByLabelText("Amount"), "10.01");
  await user.type(screen.getByLabelText("Description"), "Dinner");
  await user.selectOptions(screen.getByLabelText("Category"), "Groceries");
  await user.click(screen.getByRole("button", { name: "Percentages" }));

  const alex = screen.getByLabelText("Alex's percent");
  const sam = screen.getByLabelText("Sam's percent");
  await user.clear(alex);
  await user.type(alex, "60");
  const save = screen.getByRole("button", { name: "Save expense" });
  expect(save).toBeDisabled();
  expect(apiFetch).not.toHaveBeenCalled();
  await user.clear(sam);
  await user.type(sam, "40");
  await user.click(save);

  expect(apiFetch).toHaveBeenCalledWith("/api/households/houseA/expenses", {
    method: "POST",
    body: expect.objectContaining({
      split: "custom",
      amountCents: 1001,
      shares: [{ userId: "alex", percent: 60 }, { userId: "sam", percent: 40 }],
    }),
  });
});
