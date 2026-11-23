import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Household from "./Household";
import { apiFetch, HouseholdAPI } from "../api";

jest.mock("../api", () => ({
  apiFetch: jest.fn(),
  HouseholdAPI: { current: jest.fn(), create: jest.fn() },
}));

test("shows the current household's invite code after logging back in", async () => {
  // Log Out clears what the browser saved, so the page has to ask the API
  localStorage.clear();
  HouseholdAPI.current.mockResolvedValue({ household: { id: "houseA", name: "Apartment A" }, members: [] });
  apiFetch.mockResolvedValue({ id: "houseA", inviteCode: "ABCD2345" });

  render(<Household />, { wrapper: MemoryRouter });

  expect(await screen.findByText("ABCD2345")).toBeInTheDocument();
  expect(apiFetch).toHaveBeenCalledWith("/api/households/houseA");
});
