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
            async get() {
              const data = docs[key];
              return {
                exists: data !== undefined,
                id: docId,
                data: () => data,
              };
            },
            async set(data, options) {
              if (options && options.merge && docs[key]) {
                docs[key] = { ...docs[key], ...data };
              } else {
                docs[key] = { ...data };
              }
            },
            async update(partial) {
              docs[key] = { ...docs[key], ...partial };
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

function seed() {
  Object.keys(db.docs).forEach((key) => delete db.docs[key]);
  db.docs["households/houseA"] = {
    name: "Apartment A",
    adminId: "alex",
    memberIds: ["alex"],
    inviteCode: "AAAAAAAA",
  };
  db.docs["households/houseB"] = {
    name: "Apartment B",
    adminId: "sam",
    memberIds: ["sam"],
    inviteCode: "BBBBBBBB",
  };
  db.docs["users/alex"] = { currentHouseholdId: "houseA" };
  db.docs["users/sam"] = { currentHouseholdId: "houseB" };
}

describe("household membership", () => {
  beforeEach(() => {
    seed();
    mockVerifyIdToken.mockImplementation(async (token) => {
      if (token === "alex-token") return { uid: "alex" };
      if (token === "sam-token") return { uid: "sam" };
      if (token === "pat-token") return { uid: "pat" };
      const err = new Error("Decoding Firebase ID token failed");
      err.code = "auth/argument-error";
      throw err;
    });
  });

  it("refuses a member of another household", async () => {
    const res = await request(app)
      .get("/api/households/houseA")
      .set("Authorization", "Bearer sam-token");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "You are not a member of this household" });
  });

  it("lets a member read their own household", async () => {
    const res = await request(app)
      .get("/api/households/houseA")
      .set("Authorization", "Bearer alex-token");

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Apartment A");
    expect(res.body.memberIds).toEqual(["alex"]);
  });

  it("does not apply the membership check when creating a household", async () => {
    const res = await request(app)
      .post("/api/households")
      .set("Authorization", "Bearer pat-token")
      .send({ name: "Cabin" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Cabin");
    expect(res.body.memberIds).toEqual(["pat"]);

    const read = await request(app)
      .get(`/api/households/${res.body.id}`)
      .set("Authorization", "Bearer pat-token");
    expect(read.status).toBe(200);
  });

  it("does not apply the membership check when joining with a code", async () => {
    const blocked = await request(app)
      .get("/api/households/houseA")
      .set("Authorization", "Bearer pat-token");
    expect(blocked.status).toBe(403);

    const joined = await request(app)
      .post("/api/households/join")
      .set("Authorization", "Bearer pat-token")
      .send({ inviteCode: "AAAAAAAA" });

    expect(joined.status).toBe(200);
    expect(joined.body.id).toBe("houseA");
    expect(joined.body.memberIds).toEqual(["alex", "pat"]);

    const read = await request(app)
      .get("/api/households/houseA")
      .set("Authorization", "Bearer pat-token");
    expect(read.status).toBe(200);
  });
});
