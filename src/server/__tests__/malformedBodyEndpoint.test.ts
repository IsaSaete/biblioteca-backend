import request from "supertest";
import app from "../app.js";

describe("Given a request whose body cannot be read", () => {
  describe("When the body is not valid JSON", () => {
    it("Then it should respond 400 with a VALIDATION_ERROR, not a 500", async () => {
      const response = await request(app)
        .post("/auth/login")
        .set("Content-Type", "application/json")
        .send('{"email": ');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("When the body is larger than the limit", () => {
    it("Then it should respond 413, not a 500", async () => {
      const response = await request(app)
        .post("/auth/login")
        .set("Content-Type", "application/json")
        .send(
          JSON.stringify({ email: "a@b.co", password: "A".repeat(300_000) }),
        );

      expect(response.status).toBe(413);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
