const request = require("supertest");
const { getAuth } = require("firebase-admin/auth");

const mockDocGet = jest.fn();
const mockDoc = jest.fn(() => ({ get: mockDocGet }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));

jest.mock("firebase-admin/auth", () => ({
  getAuth: jest.fn(),
}));

jest.mock("../src/config/firebase", () => ({
  collection: (...args) => mockCollection(...args),
}));

const app = require("../src/app");

describe("HM16 - Protected routes after logout", () => {
  const verifyIdToken = jest.fn();

  beforeEach(() => {
    verifyIdToken.mockReset();
    mockDocGet.mockReset();
    getAuth.mockReturnValue({ verifyIdToken });
  });

  const protectedGets = [
    "/api/me",
    "/api/households/hh_1",
    "/api/households/hh_1/members",
    "/api/households/hh_1/expenses",
    "/api/households/hh_1/debts",
    "/api/households/hh_1/balances",
    "/api/households/hh_1/owed-to-me",
  ];

  test.each(protectedGets)(
    "blocks GET %s with 401 and no household data when no token is present after logout",
    async (route) => {
      const res = await request(app).get(route);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Authentication token is missing" });
      expect(res.body).not.toHaveProperty("household");
      expect(res.body).not.toHaveProperty("expenses");
      expect(res.body).not.toHaveProperty("debts");
      expect(res.body).not.toHaveProperty("owedToMe");
      expect(verifyIdToken).not.toHaveBeenCalled();
    }
  );

  test("blocks POST /api/households/hh_1/expenses with 401 when no token is present", async () => {
    const res = await request(app)
      .post("/api/households/hh_1/expenses")
      .send({
        amountCents: 6000,
        description: "Groceries",
        date: "2026-11-22",
        payerId: "user_1",
        category: "Groceries",
        split: "equal",
        memberIds: ["user_1"],
      });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Authentication token is missing" });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  test("blocks POST /api/auth/profile with 401 when no token is present", async () => {
    const res = await request(app)
      .post("/api/auth/profile")
      .send({ username: "priya" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Authentication token is missing" });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  test("blocks protected household routes with 401 when token is invalid or revoked", async () => {
    const err = new Error("Firebase ID token has been revoked");
    err.code = "auth/id-token-revoked";
    verifyIdToken.mockRejectedValue(err);

    const res = await request(app)
      .get("/api/households/hh_1/expenses")
      .set("Authorization", "Bearer revoked-or-stale-token");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Authentication token is invalid" });
    expect(verifyIdToken).toHaveBeenCalledWith("revoked-or-stale-token");
  });

  test("returns 403 and no household data if a valid token belongs to a non-member", async () => {
    verifyIdToken.mockResolvedValue({ uid: "outsider_uid" });
    mockDocGet.mockResolvedValue({
      exists: true,
      id: "hh_1",
      data: () => ({
        name: "Maple St House",
        adminId: "admin_uid",
        memberIds: ["admin_uid", "other_member"],
      }),
    });

    const res = await request(app)
      .get("/api/households/hh_1/expenses")
      .set("Authorization", "Bearer valid-outsider-token");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "You are not a member of this household" });
  });
});