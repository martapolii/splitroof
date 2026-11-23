const request = require("supertest");
const app = require("../src/app");

// Tests don't need a real Firestore
jest.mock("../src/config/firebase", () => ({}));

describe("GET /api/health", () => {
  it("answers with status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns 404 for a route that doesn't exist", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
  });
});
