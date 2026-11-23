const { splitEqualExpense } = require("../src/services/splitService");

describe("HM7 equal expense split", () => {
  it("gives the extra cent to the payer when A pays $10 for A, B and C", () => {
    expect(splitEqualExpense(1000, ["A", "B", "C"], "A")).toEqual([
      { memberId: "A", amountCents: 334 },
      { memberId: "B", amountCents: 333 },
      { memberId: "C", amountCents: 333 },
    ]);
  });

  it("gives the first selected member the extra cent when A pays for B, C and D", () => {
    expect(splitEqualExpense(1000, ["B", "C", "D"], "A")).toEqual([
      { memberId: "B", amountCents: 334 },
      { memberId: "C", amountCents: 333 },
      { memberId: "D", amountCents: 333 },
    ]);
  });

  it("prioritizes a selected payer even when they are last", () => {
    expect(splitEqualExpense(1000, ["B", "C", "A"], "A").map((s) => s.amountCents))
      .toEqual([333, 333, 334]);
  });

  it("distributes multiple leftover cents one at a time and preserves selection order", () => {
    expect(splitEqualExpense(2, ["B", "C", "A"], "A")).toEqual([
      { memberId: "B", amountCents: 1 },
      { memberId: "C", amountCents: 0 },
      { memberId: "A", amountCents: 1 },
    ]);
  });

  it("conserves cents and keeps equal shares within one cent for households of 1 to 6", () => {
    const ids = ["A", "B", "C", "D", "E", "F"];
    for (let size = 1; size <= ids.length; size++) {
      const members = ids.slice(0, size);
      for (const payer of [...members, "other"]) {
        for (const total of [0, 1, 2, 5, 6, 7, 99, 6000, Number.MAX_SAFE_INTEGER]) {
          const shares = splitEqualExpense(total, members, payer);
          const amounts = shares.map((share) => share.amountCents);
          expect(amounts.reduce((sum, cents) => sum + cents, 0)).toBe(total);
          expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
          expect(shares.map((share) => share.memberId)).toEqual(members);
        }
      }
    }
  });

  it.each([
    [10.5, ["A"], "A"],
    [-1, ["A"], "A"],
    [Number.MAX_SAFE_INTEGER + 1, ["A"], "A"],
    [1000, [], "A"],
    [1000, ["A", "A"], "A"],
    [1000, [" "], "A"],
    [1000, ["A"], ""],
  ])("rejects invalid split input (%j, %j, %j)", (total, members, payer) => {
    expect(() => splitEqualExpense(total, members, payer))
      .toThrow(expect.objectContaining({ status: 400 }));
  });
});
