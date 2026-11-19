const request = require("supertest");

const mockVerifyIdToken = jest.fn();

jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: (...args) => mockVerifyIdToken(...args) }),
}));

jest.mock("../src/config/firebase", () => {
  const docs = {};
  const versions = {};
  let sequence = 1;

  function versionOf(key) {
    return versions[key] || 0;
  }

  function bump(key) {
    versions[key] = versionOf(key) + 1;
  }

  function writeDoc(key, data, options) {
    if (options && options.merge && docs[key]) {
      docs[key] = { ...docs[key], ...data };
    } else {
      docs[key] = { ...data };
    }
    bump(key);
  }

  function updateDoc(key, partial) {
    docs[key] = { ...docs[key], ...partial };
    bump(key);
  }

  function snapshotData(data) {
    if (!data) return data;
    return {
      ...data,
      memberIds: Array.isArray(data.memberIds) ? [...data.memberIds] : data.memberIds,
    };
  }

  function matches(name, field, value) {
    return Object.entries(docs)
      .filter(([key, data]) => key.startsWith(`${name}/`) && data[field] === value)
      .map(([key, data]) => ({
        id: key.slice(name.length + 1),
        refKey: key,
        data: () => data,
      }));
  }

  const api = {
    docs,
    versions,
    afterHouseholdRead: null,
    collection(name) {
      return {
        doc(id) {
          const docId = id || `generated_${sequence}`;
          if (!id) sequence += 1;
          const key = `${name}/${docId}`;
          return {
            id: docId,
            _key: key,
            async get() {
              const data = docs[key];
              return {
                exists: data !== undefined,
                id: docId,
                data: () => data,
              };
            },
            async set(data, options) {
              writeDoc(key, data, options);
            },
            async update(partial) {
              updateDoc(key, partial);
            },
          };
        },
        where(field, _op, value) {
          return {
            _collection: name,
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
    async runTransaction(updateFunction) {
      const maxAttempts = 5;
      let lastError;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const readVersions = new Map();
        const writes = [];
        let startedWriting = false;

        const transaction = {
          async get(target) {
            if (startedWriting) {
              throw new Error("Firestore transactions require all reads to be executed before all writes.");
            }
            const snap = await target.get();
            if (Array.isArray(snap.docs)) {
              const frozenDocs = snap.docs.map((doc) => {
                readVersions.set(doc.refKey, versionOf(doc.refKey));
                const frozen = snapshotData(doc.data());
                return { ...doc, data: () => frozen };
              });
              if (target._collection === "households" && typeof api.afterHouseholdRead === "function") {
                await api.afterHouseholdRead();
              }
              return { empty: frozenDocs.length === 0, docs: frozenDocs };
            }

            readVersions.set(target._key, versionOf(target._key));
            const frozen = snapshotData(snap.data());
            if (typeof target._key === "string" && target._key.startsWith("households/") && typeof api.afterHouseholdRead === "function") {
              await api.afterHouseholdRead();
            }
            return { ...snap, data: () => frozen };
          },
          update(ref, partial) {
            startedWriting = true;
            writes.push(() => updateDoc(ref._key, partial));
          },
          set(ref, data, options) {
            startedWriting = true;
            writes.push(() => writeDoc(ref._key, data, options));
          },
        };

        try {
          const result = await updateFunction(transaction);
          for (const [key, version] of readVersions) {
            if (versionOf(key) !== version) {
              const err = new Error("Transaction aborted due to contention");
              err.code = 10;
              throw err;
            }
          }
          writes.forEach((apply) => apply());
          return result;
        } catch (err) {
          if (err.code !== 10) throw err;
          lastError = err;
        }
      }
      throw lastError;
    },
  };

  return api;
});

const app = require("../src/app");
const db = require("../src/config/firebase");

const CODE_CHARS = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

function seed() {
  Object.keys(db.docs).forEach((key) => delete db.docs[key]);
  Object.keys(db.versions).forEach((key) => delete db.versions[key]);
  db.afterHouseholdRead = null;
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
  db.docs["users/alex"] = {
    email: "alex@example.com",
    username: "Alex",
    currentHouseholdId: "houseA",
  };
  db.docs["users/sam"] = {
    email: "sam@example.com",
    username: "Sam",
    currentHouseholdId: "houseB",
  };
}

function authenticate() {
  mockVerifyIdToken.mockImplementation(async (token) => {
    if (token === "alex-token") return { uid: "alex" };
    if (token === "sam-token") return { uid: "sam" };
    if (token === "pat-token") return { uid: "pat" };
    const err = new Error("Decoding Firebase ID token failed");
    err.code = "auth/argument-error";
    throw err;
  });
}

describe("POST /api/households", () => {
  beforeEach(() => {
    seed();
    authenticate();
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

    const previous = await request(app)
      .get("/api/households/houseA")
      .set("Authorization", "Bearer alex-token");
    expect(previous.status).toBe(200);

    const current = await request(app)
      .get(`/api/households/${res.body.id}`)
      .set("Authorization", "Bearer alex-token");
    expect(current.status).toBe(200);
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

describe("household membership", () => {
  beforeEach(() => {
    seed();
    authenticate();
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

  it("lets a member create another household without leaving the first", async () => {
    const created = await request(app)
      .post("/api/households")
      .set("Authorization", "Bearer alex-token")
      .send({ name: "Apartment C" });

    expect(created.status).toBe(201);
    expect(created.body.memberIds).toEqual(["alex"]);
    expect(created.body.adminId).toBe("alex");
    expect(db.docs["households/houseA"].memberIds).toEqual(["alex"]);
    expect(db.docs["users/alex"].currentHouseholdId).toBe(created.body.id);

    const previous = await request(app)
      .get("/api/households/houseA")
      .set("Authorization", "Bearer alex-token");
    expect(previous.status).toBe(200);

    const current = await request(app)
      .get(`/api/households/${created.body.id}`)
      .set("Authorization", "Bearer alex-token");
    expect(current.status).toBe(200);
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

  it("lets a member join another household and keeps the previous membership", async () => {
    const joined = await request(app)
      .post("/api/households/join")
      .set("Authorization", "Bearer alex-token")
      .send({ inviteCode: "BBBBBBBB" });

    expect(joined.status).toBe(200);
    expect(joined.body.id).toBe("houseB");
    expect(joined.body.memberIds).toEqual(["sam", "alex"]);
    expect(db.docs["households/houseA"].memberIds).toEqual(["alex"]);
    expect(db.docs["users/alex"].currentHouseholdId).toBe("houseB");

    const previous = await request(app)
      .get("/api/households/houseA")
      .set("Authorization", "Bearer alex-token");
    expect(previous.status).toBe(200);
  });

  it("switches the current household when joining one the user already belongs to", async () => {
    db.docs["users/alex"].currentHouseholdId = "houseB";
    db.docs["households/houseB"].memberIds = ["sam", "alex"];

    const joined = await request(app)
      .post("/api/households/join")
      .set("Authorization", "Bearer alex-token")
      .send({ inviteCode: "AAAAAAAA" });

    expect(joined.status).toBe(200);
    expect(joined.body.memberIds).toEqual(["alex"]);
    expect(db.docs["users/alex"].currentHouseholdId).toBe("houseA");
    expect(db.docs["households/houseB"].memberIds).toEqual(["sam", "alex"]);
  });

  it("returns 404 for a wrong invite code and does not add the user", async () => {
    const res = await request(app)
      .post("/api/households/join")
      .set("Authorization", "Bearer pat-token")
      .send({ inviteCode: "ZZZZZZZZ" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Invite code is not valid" });
    expect(db.docs["households/houseA"].memberIds).toEqual(["alex"]);
    expect(db.docs["households/houseB"].memberIds).toEqual(["sam"]);
    expect(db.docs["users/pat"]).toBeUndefined();
  });

  it("joins when the invite code uses different capitalization", async () => {
    const joined = await request(app)
      .post("/api/households/join")
      .set("Authorization", "Bearer pat-token")
      .send({ inviteCode: "aaaaaaaa" });

    expect(joined.status).toBe(200);
    expect(joined.body.id).toBe("houseA");
    expect(joined.body.memberIds).toEqual(["alex", "pat"]);
  });

  it("rejects a join when the household already has 6 members", async () => {
    db.docs["households/houseA"].memberIds = ["a", "b", "c", "d", "e", "f"];

    const res = await request(app)
      .post("/api/households/join")
      .set("Authorization", "Bearer pat-token")
      .send({ inviteCode: "AAAAAAAA" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "This household is full" });
    expect(db.docs["households/houseA"].memberIds).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(db.docs["users/pat"]).toBeUndefined();
  });

  it("keeps both members when two people join at the same time", async () => {
    let release;
    const firstRead = new Promise((resolve) => {
      db.afterHouseholdRead = () => {
        if (release) return undefined;
        return new Promise((done) => {
          release = done;
          resolve();
        });
      };
    });

    const patJoin = request(app)
      .post("/api/households/join")
      .set("Authorization", "Bearer pat-token")
      .send({ inviteCode: "AAAAAAAA" });
    // Supertest does not send the request until then() runs.
    patJoin.then(() => {}, () => {});

    await firstRead;
    const samJoin = await request(app)
      .post("/api/households/join")
      .set("Authorization", "Bearer sam-token")
      .send({ inviteCode: "AAAAAAAA" });
    release();
    const patJoined = await patJoin;

    expect(samJoin.status).toBe(200);
    expect(patJoined.status).toBe(200);
    expect(db.docs["households/houseA"].memberIds).toEqual(["alex", "sam", "pat"]);
    expect(db.docs["users/sam"].currentHouseholdId).toBe("houseA");
    expect(db.docs["users/pat"].currentHouseholdId).toBe("houseA");
    expect(db.docs["households/houseB"].memberIds).toEqual(["sam"]);
  });
});

describe("household routes require sign-in", () => {
  it("returns 401 for GET /api/households/current without a token", async () => {
    const res = await request(app).get("/api/households/current");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication token is missing");
  });
});

describe("GET /api/households/:householdId/members and /expenses", () => {
  beforeEach(() => {
    seed();
    authenticate();
  });

  it("returns the members' uid and username, without email", async () => {
    db.docs["households/houseA"].memberIds = ["alex", "sam"];

    const res = await request(app)
      .get("/api/households/houseA/members")
      .set("Authorization", "Bearer alex-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { uid: "alex", username: "Alex" },
      { uid: "sam", username: "Sam" },
    ]);
  });

  it("refuses the members list to someone outside the household", async () => {
    const res = await request(app)
      .get("/api/households/houseA/members")
      .set("Authorization", "Bearer sam-token");

    expect(res.status).toBe(403);
  });

  it("returns 401 for members and expenses without a token", async () => {
    const members = await request(app).get("/api/households/houseA/members");
    const expenses = await request(app).get("/api/households/houseA/expenses");

    expect(members.status).toBe(401);
    expect(expenses.status).toBe(401);
  });

  it("returns only this household's expenses, newest first", async () => {
    db.docs["expenses/e1"] = { householdId: "houseA", amountCents: 1000, description: "Old", date: "2026-11-01", payerId: "alex", category: "Groceries" };
    db.docs["expenses/e2"] = { householdId: "houseA", amountCents: 2500, description: "New", date: "2026-11-15", payerId: "alex", category: "Utilities" };
    db.docs["expenses/e3"] = { householdId: "houseB", amountCents: 999, description: "Not ours", date: "2026-11-20", payerId: "sam", category: "Other" };

    const res = await request(app)
      .get("/api/households/houseA/expenses")
      .set("Authorization", "Bearer alex-token");

    expect(res.status).toBe(200);
    expect(res.body.map((e) => e.id)).toEqual(["e2", "e1"]);
    expect(res.body[0].description).toBe("New");
  });

  it("returns an empty list when the household has no expenses yet", async () => {
    const res = await request(app)
      .get("/api/households/houseA/expenses")
      .set("Authorization", "Bearer alex-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("refuses the expenses list to someone outside the household", async () => {
    const res = await request(app)
      .get("/api/households/houseA/expenses")
      .set("Authorization", "Bearer sam-token");

    expect(res.status).toBe(403);
  });
});
