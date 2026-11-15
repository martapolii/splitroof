const request = require("supertest");
const { getAuth } = require("firebase-admin/auth");
const app = require("../src/app");

jest.mock("firebase-admin/auth", () => ({
  getAuth: jest.fn(),
}));

jest.mock("../src/config/firebase", () => ({}));

describe("GET /api/me", () => {
  const verifyIdToken = jest.fn();

  beforeEach(() => {
    verifyIdToken.mockReset();
    getAuth.mockReturnValue({ verifyIdToken });
  });

  it("lets a valid token through to the handler", async () => {
    verifyIdToken.mockResolvedValue({ uid: "user_123", email: "alex@example.com" });

    const res = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ uid: "user_123" });
    expect(verifyIdToken).toHaveBeenCalledWith("valid-token");
  });

  it("returns 401 when the token is missing", async () => {
    const res = await request(app).get("/api/me");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Authentication token is missing" });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("returns 401 when the token is invalid", async () => {
    const err = new Error("Decoding Firebase ID token failed");
    err.code = "auth/argument-error";
    verifyIdToken.mockRejectedValue(err);

    const res = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer not-a-real-token");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Authentication token is invalid" });
    expect(verifyIdToken).toHaveBeenCalledWith("not-a-real-token");
  });
});
