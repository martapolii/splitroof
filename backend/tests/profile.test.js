const request = require("supertest");

const mockVerifyIdToken = jest.fn();

jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: (...args) => mockVerifyIdToken(...args) }),
}));

jest.mock("../src/config/firebase", () => {
  const docs = {};
  return {
    docs,
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return {
            id,
            async get() {
              return { exists: key in docs, data: () => docs[key] };
            },
            async set(data) {
              docs[key] = { ...data };
            },
          };
        },
        where(field, _op, value) {
          return {
            limit() {
              return this;
            },
            async get() {
              const found = Object.entries(docs)
                .filter(([key, d]) => key.startsWith(`${name}/`) && d[field] === value)
                .map(([key, d]) => ({ id: key.slice(name.length + 1), data: () => d }));
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

describe("POST /api/auth/profile", () => {
  beforeEach(() => {
    Object.keys(db.docs).forEach((key) => delete db.docs[key]);
    mockVerifyIdToken.mockReset();
    mockVerifyIdToken.mockResolvedValue({ uid: "user_1", email: "Alex@Example.com" });
  });

  const send = (body) =>
    request(app).post("/api/auth/profile").set("Authorization", "Bearer t").send(body);

  it("saves the profile with a lowercase email and no household", async () => {
    const res = await send({ username: "Alex" });
    expect(res.status).toBe(201);
    expect(db.docs["users/user_1"]).toEqual({
      email: "alex@example.com",
      username: "Alex",
      usernameLower: "alex",
      currentHouseholdId: null,
    });
  });

  it("returns 400 when the username is missing", async () => {
    const res = await send({});
    expect(res.status).toBe(400);
    expect(db.docs["users/user_1"]).toBeUndefined();
  });

  it("returns 409 when another user has the name, ignoring capitalization", async () => {
    db.docs["users/other"] = { username: "ALEX", usernameLower: "alex" };
    const res = await send({ username: "alex" });
    expect(res.status).toBe(409);
    expect(db.docs["users/user_1"]).toBeUndefined();
  });

  it("keeps the current household if the same user saves again", async () => {
    db.docs["users/user_1"] = { username: "Alex", usernameLower: "alex", currentHouseholdId: "h1" };
    const res = await send({ username: "Alex" });
    expect(res.status).toBe(201);
    expect(db.docs["users/user_1"].currentHouseholdId).toBe("h1");
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).post("/api/auth/profile").send({ username: "Alex" });
    expect(res.status).toBe(401);
  });
});