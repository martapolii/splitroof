const { runningBalances } = require("../src/services/balanceService");

const tenDollars = {
  payerId: "A",
  amountCents: 1000,
  shares: [
    { userId: "A", amountCents: 334 },
    { userId: "B", amountCents: 333 },
    { userId: "C", amountCents: 333 },
  ],
};

describe("HM7 running balances from saved shares", () => {
  it("gives A +$6.66, B -$3.33 and C -$3.33 when A pays $10 for A, B and C", () => {
    expect(runningBalances(["A", "B", "C"], [tenDollars])).toEqual([
      { userId: "A", balanceCents: 666 },
      { userId: "B", balanceCents: -333 },
      { userId: "C", balanceCents: -333 },
    ]);
  });

  it("leaves a member who is not in the expense and did not pay it unchanged", () => {
    expect(runningBalances(["A", "B", "C", "D"], [tenDollars])).toEqual([
      { userId: "A", balanceCents: 666 },
      { userId: "B", balanceCents: -333 },
      { userId: "C", balanceCents: -333 },
      { userId: "D", balanceCents: 0 },
    ]);
  });

  it("credits the payer when they are not one of the shares", () => {
    const expense = {
      payerId: "A",
      amountCents: 1000,
      shares: [
        { userId: "B", amountCents: 334 },
        { userId: "C", amountCents: 333 },
        { userId: "D", amountCents: 333 },
      ],
    };

    expect(runningBalances(["A", "B", "C", "D"], [expense])).toEqual([
      { userId: "A", balanceCents: 1000 },
      { userId: "B", balanceCents: -334 },
      { userId: "C", balanceCents: -333 },
      { userId: "D", balanceCents: -333 },
    ]);
  });

  it("adds later expenses onto the same balances", () => {
    const dinner = {
      payerId: "B",
      amountCents: 900,
      shares: [
        { userId: "A", amountCents: 300 },
        { userId: "B", amountCents: 300 },
        { userId: "C", amountCents: 300 },
      ],
    };

    const balances = runningBalances(["A", "B", "C"], [tenDollars, dinner]);

    expect(balances).toEqual([
      { userId: "A", balanceCents: 366 },
      { userId: "B", balanceCents: 267 },
      { userId: "C", balanceCents: -633 },
    ]);
    expect(balances.reduce((sum, row) => sum + row.balanceCents, 0)).toBe(0);
  });

  it("reads a share saved with memberId and still sums to zero", () => {
    const balances = runningBalances(["A", "B"], [
      {
        payerId: "A",
        amountCents: 500,
        shares: [
          { memberId: "A", amountCents: 250 },
          { memberId: "B", amountCents: 250 },
        ],
      },
    ]);

    expect(balances).toEqual([
      { userId: "A", balanceCents: 250 },
      { userId: "B", balanceCents: -250 },
    ]);
  });

  it("includes someone who left so the balances still add up to zero", () => {
    const balances = runningBalances(["A", "B"], [
      {
        payerId: "A",
        amountCents: 900,
        shares: [
          { userId: "A", amountCents: 300 },
          { userId: "B", amountCents: 300 },
          { userId: "C", amountCents: 300 },
        ],
      },
    ]);

    expect(balances).toEqual([
      { userId: "A", balanceCents: 600 },
      { userId: "B", balanceCents: -300 },
      { userId: "C", balanceCents: -300 },
    ]);
    expect(balances.reduce((sum, row) => sum + row.balanceCents, 0)).toBe(0);
  });

  it("starts everyone at zero when there are no expenses", () => {
    expect(runningBalances(["A", "B"], [])).toEqual([
      { userId: "A", balanceCents: 0 },
      { userId: "B", balanceCents: 0 },
    ]);
  });

  it.each([
    [null, []],
    [["A", ""], []],
    [["A"], null],
    [["A"], [{ payerId: "A", amountCents: 10.5, shares: [] }]],
    [["A"], [{ payerId: "A", amountCents: 100, shares: [{ userId: "A" }] }]],
    [["A"], [{ amountCents: 100, shares: [{ userId: "A", amountCents: 100 }] }]],
  ])("rejects invalid balance input (%j, %j)", (members, expenses) => {
    expect(() => runningBalances(members, expenses))
      .toThrow(expect.objectContaining({ status: 400 }));
  });
});
