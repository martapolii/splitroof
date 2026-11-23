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
const { sharesOwedToUser } = require("../src/services/owedService");

// alex paid $90 split three ways, so sam and pat owe alex $30 each.
// sam paid $30 split between sam and pat, so pat owes sam $15 (a debt between other members).
function seed() {
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
  db.docs["expenses/e1"] = {
    householdId: "houseA",
    amountCents: 9000,
    payerId: "alex",
    shares: [
      { userId: "alex", amountCents: 3000 },
      { userId: "sam", amountCents: 3000 },
      { userId: "pat", amountCents: 3000 },
    ],
  };
  db.docs["expenses/e2"] = {
    householdId: "houseA",
    amountCents: 3000,
    payerId: "sam",
    shares: [
      { userId: "sam", amountCents: 1500 },
      { userId: "pat", amountCents: 1500 },
    ],
  };
}

function authenticate() {
  mockVerifyIdToken.mockImplementation(async (token) => {
    if (token === "alex-token") return { uid: "alex" };
    if (token === "sam-token") return { uid: "sam" };
    if (token === "zed-token") return { uid: "zed" };
    const err = new Error("Decoding Firebase ID token failed");
    err.code = "auth/argument-error";
    throw err;
  });
}

describe("sharesOwedToUser", () => {
  it("2 members owing $30 each returns $30 each and a $60 total", () => {
    const expenses = [{
      payerId: "alex",
      shares: [
        { userId: "alex", amountCents: 3000 },
        { userId: "sam", amountCents: 3000 },
        { userId: "pat", amountCents: 3000 },
      ],
    }];

    expect(sharesOwedToUser("alex", expenses)).toEqual({
      owed: [
        { userId: "pat", amountCents: 3000 },
        { userId: "sam", amountCents: 3000 },
      ],
      totalCents: 6000,
    });
  });

  it("leaves out expenses paid by someone else", () => {
    const expenses = [{
      payerId: "sam",
      shares: [
        { userId: "sam", amountCents: 1500 },
        { userId: "pat", amountCents: 1500 },
      ],
    }];

    expect(sharesOwedToUser("alex", expenses)).toEqual({ owed: [], totalCents: 0 });
  });

  it("adds up what one member owes across several expenses", () => {
    const expenses = [
      { payerId: "alex", shares: [{ userId: "sam", amountCents: 1000 }] },
      { payerId: "alex", shares: [{ userId: "sam", amountCents: 250 }] },
    ];

    expect(sharesOwedToUser("alex", expenses)).toEqual({
      owed: [{ userId: "sam", amountCents: 1250 }],
      totalCents: 1250,
    });
  });

  it("ignores the user's own share and zero shares", () => {
    const expenses = [{
      payerId: "alex",
      shares: [
        { userId: "alex", amountCents: 500 },
        { userId: "sam", amountCents: 0 },
      ],
    }];

    expect(sharesOwedToUser("alex", expenses)).toEqual({ owed: [], totalCents: 0 });
  });

  // alex paid $30 split with sam (sam owes $15), sam paid $20 split with alex (alex owes $10)
  it("only shows the difference when the user also owes that member", () => {
    const expenses = [
      { payerId: "alex", shares: [{ userId: "alex", amountCents: 1500 }, { userId: "sam", amountCents: 1500 }] },
      { payerId: "sam", shares: [{ userId: "sam", amountCents: 1000 }, { userId: "alex", amountCents: 1000 }] },
    ];

    expect(sharesOwedToUser("alex", expenses)).toEqual({
      owed: [{ userId: "sam", amountCents: 500 }],
      totalCents: 500,
    });
  });

  it("leaves a member out when the user owes them more than they owe the user", () => {
    const expenses = [
      { payerId: "alex", shares: [{ userId: "sam", amountCents: 1000 }] },
      { payerId: "sam", shares: [{ userId: "alex", amountCents: 2500 }] },
    ];

    expect(sharesOwedToUser("alex", expenses)).toEqual({ owed: [], totalCents: 0 });
  });
});

describe("GET /api/households/:householdId/owed-to-me", () => {
  beforeEach(() => {
    seed();
    authenticate();
  });

  it("shows who owes the signed-in user, with a total, and hides debts between others", async () => {
    const res = await request(app)
      .get("/api/households/houseA/owed-to-me")
      .set("Authorization", "Bearer alex-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      owedToMe: [
        { userId: "pat", username: "Pat", amountCents: 3000 },
        { userId: "sam", username: "Sam", amountCents: 3000 },
      ],
      totalCents: 6000,
    });
  });

  it("uses the user from the token, not a user id in the request", async () => {
    const res = await request(app)
      .get("/api/households/houseA/owed-to-me?userId=sam")
      .set("Authorization", "Bearer alex-token");

    expect(res.status).toBe(200);
    expect(res.body.totalCents).toBe(6000);
  });

  it("shows another member only what is owed to them", async () => {
    const res = await request(app)
      .get("/api/households/houseA/owed-to-me")
      .set("Authorization", "Bearer sam-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      owedToMe: [{ userId: "pat", username: "Pat", amountCents: 1500 }],
      totalCents: 1500,
    });
  });

  it("gives the same amount as /debts when two people paid for each other", async () => {
    // sam paid $20 split with alex, so alex owes sam $10 back
    db.docs["expenses/e3"] = {
      householdId: "houseA",
      amountCents: 2000,
      payerId: "sam",
      shares: [
        { userId: "sam", amountCents: 1000 },
        { userId: "alex", amountCents: 1000 },
      ],
    };

    const owedRes = await request(app)
      .get("/api/households/houseA/owed-to-me")
      .set("Authorization", "Bearer alex-token");
    const debtsRes = await request(app)
      .get("/api/households/houseA/debts")
      .set("Authorization", "Bearer alex-token");

    expect(owedRes.status).toBe(200);
    expect(owedRes.body).toEqual({
      owedToMe: [
        { userId: "pat", username: "Pat", amountCents: 3000 },
        { userId: "sam", username: "Sam", amountCents: 2000 },
      ],
      totalCents: 5000,
    });
    const samDebt = debtsRes.body.debts.find((debt) => debt.fromUserId === "sam" && debt.toUserId === "alex");
    expect(samDebt.amountCents).toBe(2000);
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/households/houseA/owed-to-me");

    expect(res.status).toBe(401);
  });

  it("returns 403 for someone outside the household", async () => {
    const res = await request(app)
      .get("/api/households/houseA/owed-to-me")
      .set("Authorization", "Bearer zed-token");

    expect(res.status).toBe(403);
  });
});