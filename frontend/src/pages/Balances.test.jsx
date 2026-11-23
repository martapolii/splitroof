import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Balances from "./Balances";
import { HouseholdAPI } from "../api";

jest.mock("../api", () => ({
  HouseholdAPI: {
    current: jest.fn(),
    balances: jest.fn(),
    debts: jest.fn(),
  },
}));

describe("Balances page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("displays each member's running balance and who owes whom", async () => {
    HouseholdAPI.current.mockResolvedValue({
      household: { id: "houseA", name: "Apartment A" },
      members: [
        { uid: "alex", username: "Alex" },
        { uid: "sam", username: "Sam" },
        { uid: "pat", username: "Pat" },
      ],
    });
    HouseholdAPI.balances.mockResolvedValue([
      { userId: "alex", balanceCents: 6000 },
      { userId: "sam", balanceCents: -3000 },
      { userId: "pat", balanceCents: -3000 },
    ]);
    HouseholdAPI.debts.mockResolvedValue({
      debts: [
        { fromUserId: "sam", fromUsername: "Sam", toUserId: "alex", toUsername: "Alex", amountCents: 3000 },
        { fromUserId: "pat", fromUsername: "Pat", toUserId: "alex", toUsername: "Alex", amountCents: 3000 },
      ],
    });

    render(
      <MemoryRouter>
        <Balances />
      </MemoryRouter>
    );

    expect(await screen.findByText("Apartment A")).toBeInTheDocument();
    expect(screen.getByText("+$60.00")).toBeInTheDocument();
    expect(screen.getAllByText("-$30.00")).toHaveLength(2);
    expect(screen.getByText("Sam owes Alex")).toBeInTheDocument();
    expect(screen.getByText("Pat owes Alex")).toBeInTheDocument();
    expect(screen.getAllByText("$30.00")).toHaveLength(2);
  });
});