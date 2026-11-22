const request = require("supertest");

const mockVerifyIdToken = jest.fn();

jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: (...args) => mockVerifyIdToken(...args) }),
}));

// A small fake Firestore: documents live in a plain object keyed "collection/id".
jest.mock("../src/config/firebase", () => {
  const docs = {};
  return {
    docs,
    collection(name) {
      return {
        doc(id) {
          return {
            id,
            async get() {
              const data = docs[`${name}/${id}`];
              return { exists: data !== undefined, id, data: () => data };
            },
          };
        },
        where(field, _op, value) {
          return {
            async get() {
              const found = Object.entries(docs)
                .filter(([key, data]) => key.startsWith(`${name}/`) && data[field] === value)
                .map(([key, data]) => ({ id: key.slice(name.length + 1), data: () => data }));
              return { empty: found.length === 0, docs: found };
            },
          };
        },
      };
    },
  };
});

const app = require("../src/app");
const db = require("../src/config/firebase");
const { debtsBetweenMembers } = require("../src/services/debtService");
const { runningBalances } = require("../src/services/balanceService");

// alex (A) pays $90 for alex, sam and pat (A, B and C): A +$60, B -$30, C -$30.
const ninetyDollars = {
  payerId: "alex",
  amountCents: 9000,
  shares: [
    { userId: "alex", amountCents: 3000 },
    { userId: "sam", amountCents: 3000 },
    { userId: "pat", amountCents: 3000 },
  ],
};

function seed(expenses) {
  Object.keys(db.docs).forEach((key) => delete db.docs[key]);
  db.docs["households/houseA"] = {
    name: "Apartment A",
    adminId: "alex",
    memberIds: ["alex", "sam", "pat"],
    inviteCode: "AAAAAAAA",
  };
  db.docs["users/alex"] = { username: "Alex" };
  db.docs["users/sam"] = { username: "Sam" };
  db.docs["users/pat"] = { username: "Pat" };
  expenses.forEach((expense, index) => {
    db.docs[`expenses/e${index}`] = { householdId: "houseA", ...expense };
  });
}

function authenticate() {
  mockVerifyIdToken.mockImplementation(async (token) => {
    if (token === "alex-token") return { uid: "alex" };
    if (token === "zed-token") return { uid: "zed" };
    const err = new Error("Decoding Firebase ID token failed");
    err.code = "auth/argument-error";
    throw err;
  });
}

describe("debtsBetweenMembers", () => {
  it("A paying $90 for A, B and C means B and C each owe A $30", () => {
    expect(debtsBetweenMembers([ninetyDollars])).toEqual([
      { fromUserId: "pat", toUserId: "alex", amountCents: 3000 },
      { fromUserId: "sam", toUserId: "alex", amountCents: 3000 },
    ]);
  });

  it("includes debts between members who are not the signed-in user", () => {
    const expenses = [{
      payerId: "sam",
      shares: [
        { userId: "sam", amountCents: 500 },
        { userId: "pat", amountCents: 500 },
      ],
    }];

    expect(debtsBetweenMembers(expenses)).toEqual([
      { fromUserId: "pat", toUserId: "sam", amountCents: 500 },
    ]);
  });

  it("nets two people's debts into one amount", () => {
    const expenses = [
      { payerId: "alex", shares: [{ userId: "sam", amountCents: 1000 }] },
      { payerId: "sam", shares: [{ userId: "alex", amountCents: 400 }] },
    ];

    expect(debtsBetweenMembers(expenses)).toEqual([
      { fromUserId: "sam", toUserId: "alex", amountCents: 600 },
    ]);
  });

  it("lists nothing when two people's debts cancel out", () => {
    const expenses = [
      { payerId: "alex", shares: [{ userId: "sam", amountCents: 400 }] },
      { payerId: "sam", shares: [{ userId: "alex", amountCents: 400 }] },
    ];

    expect(debtsBetweenMembers(expenses)).toEqual([]);
  });

  it("agrees with each member's running balance", () => {
    const expenses = [
      ninetyDollars,
      { payerId: "sam", amountCents: 600, shares: [{ userId: "pat", amountCents: 600 }] },
    ];

    const net = {};
    debtsBetweenMembers(expenses).forEach((debt) => {
      net[debt.toUserId] = (net[debt.toUserId] || 0) + debt.amountCents;
      net[debt.fromUserId] = (net[debt.fromUserId] || 0) - debt.amountCents;
    });
    runningBalances(["alex", "sam", "pat"], expenses).forEach((row) => {
      expect(net[row.userId] || 0).toBe(row.balanceCents);
    });
  });
});

describe("GET /api/households/:householdId/balances and /debts", () => {
  beforeEach(() => {
    seed([ninetyDollars]);
    authenticate();
  });

  it("balances: A paying $90 for A, B and C gives A +$60, B -$30 and C -$30", async () => {
    const res = await request(app)
      .get("/api/households/houseA/balances")
      .set("Authorization", "Bearer alex-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { userId: "alex", balanceCents: 6000 },
      { userId: "sam", balanceCents: -3000 },
      { userId: "pat", balanceCents: -3000 },
    ]);
  });

  it("debts: returns who owes whom, with usernames", async () => {
    const res = await request(app)
      .get("/api/households/houseA/debts")
      .set("Authorization", "Bearer alex-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      debts: [
        { fromUserId: "pat", fromUsername: "Pat", toUserId: "alex", toUsername: "Alex", amountCents: 3000 },
        { fromUserId: "sam", fromUsername: "Sam", toUserId: "alex", toUsername: "Alex", amountCents: 3000 },
      ],
    });
  });

  it("debts: returns an empty list when there are no expenses", async () => {
    seed([]);

    const res = await request(app)
      .get("/api/households/houseA/debts")
      .set("Authorization", "Bearer alex-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ debts: [] });
  });

  it("returns 401 without a token", async () => {
    const balances = await request(app).get("/api/households/houseA/balances");
    const debts = await request(app).get("/api/households/houseA/debts");

    expect(balances.status).toBe(401);
    expect(debts.status).toBe(401);
  });

  it("returns 403 for someone outside the household", async () => {
    const res = await request(app)
      .get("/api/households/houseA/debts")
      .set("Authorization", "Bearer zed-token");

    expect(res.status).toBe(403);
  });
});