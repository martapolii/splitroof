const request = require("supertest");

const mockVerifyIdToken = jest.fn();

jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: (...args) => mockVerifyIdToken(...args) }),
}));

jest.mock("../src/config/firebase", () => {
  const docs = {};
  let sequence = 1;

  function matches(name, field, value) {
    return Object.entries(docs)
      .filter(([key, data]) => key.startsWith(`${name}/`) && data[field] === value)
      .map(([key, data]) => ({
        id: key.slice(name.length + 1),
        data: () => data,
      }));
  }

  return {
    docs,
    collection(name) {
      return {
        doc(id) {
          const docId = id || `generated_${sequence}`;
          if (!id) sequence += 1;
          const key = `${name}/${docId}`;
          return {
            id: docId,
            async set(data, options) {
              if (options && options.merge && docs[key]) {
                docs[key] = { ...docs[key], ...data };
              } else {
                docs[key] = { ...data };
              }
            },
          };
        },
        where(field, _op, value) {
          return {
            limit() {
              return this;
            },
            async get() {
              const found = matches(name, field, value);
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

const CODE_CHARS = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

function seed() {
  Object.keys(db.docs).forEach((key) => delete db.docs[key]);
  db.docs["households/houseA"] = {
    name: "Apartment A",
    adminId: "alex",
    memberIds: ["alex"],
    inviteCode: "AAAAAAAA",
  };
  db.docs["users/alex"] = {
    email: "alex@example.com",
    username: "Alex",
    currentHouseholdId: "houseA",
  };
}

describe("POST /api/households", () => {
  beforeEach(() => {
    seed();
    mockVerifyIdToken.mockImplementation(async (token) => {
      if (token === "alex-token") return { uid: "alex" };
      if (token === "pat-token") return { uid: "pat" };
      const err = new Error("Decoding Firebase ID token failed");
      err.code = "auth/argument-error";
      throw err;
    });
  });

  it("makes the creator the first member and the household admin", async () => {
    const res = await request(app)
      .post("/api/households")
      .set("Authorization", "Bearer pat-token")
      .send({ name: "  Cabin  " });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Cabin");
    expect(res.body.adminId).toBe("pat");
    expect(res.body.memberIds).toEqual(["pat"]);
    expect(res.body.inviteCode).toMatch(CODE_CHARS);

    const stored = db.docs[`households/${res.body.id}`];
    expect(stored).toEqual({
      name: "Cabin",
      adminId: "pat",
      memberIds: ["pat"],
      inviteCode: res.body.inviteCode,
    });
    expect(db.docs["users/pat"]).toEqual({ currentHouseholdId: res.body.id });
  });

  it("creates a second household and leaves the first one unchanged", async () => {
    const firstHousehold = { ...db.docs["households/houseA"], memberIds: ["alex"] };

    const res = await request(app)
      .post("/api/households")
      .set("Authorization", "Bearer alex-token")
      .send({ name: "Apartment C" });

    expect(res.status).toBe(201);
    expect(res.body.adminId).toBe("alex");
    expect(res.body.memberIds).toEqual(["alex"]);
    expect(res.body.id).not.toBe("houseA");
    expect(db.docs["households/houseA"]).toEqual(firstHousehold);
    expect(db.docs["users/alex"]).toEqual({
      email: "alex@example.com",
      username: "Alex",
      currentHouseholdId: res.body.id,
    });
  });

  it("returns 400 when the name is missing", async () => {
    const res = await request(app)
      .post("/api/households")
      .set("Authorization", "Bearer pat-token")
      .send({ name: "   " });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Household name is required" });
  });

  it("returns 401 when the token is missing", async () => {
    const res = await request(app).post("/api/households").send({ name: "Cabin" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Authentication token is missing" });
  });
});
