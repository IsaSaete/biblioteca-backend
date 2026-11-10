import express from "express";
import request from "supertest";
import handleError from "../../../../middleware/handleError.js";
import { createLoginAccountRateLimiter } from "../limitLoginAttemptsPerAccount.js";

const CORRECT_PASSWORD = "right";

const buildApp = (limit: number) => {
  const app = express();
  app.use(express.json());
  app.post("/login", createLoginAccountRateLimiter({ limit }), (req, res) => {
    res.status(req.body.password === CORRECT_PASSWORD ? 200 : 401).json({});
  });
  app.use(handleError);

  return app;
};

// Cada intento simula venir de una IP distinta: el límite por cuenta no debe
// fiarse de ella.
let fakeIp = 0;
const attempt = (app: express.Express, email: unknown, password = "wrong") =>
  request(app)
    .post("/login")
    .set("X-Forwarded-For", `10.0.0.${(fakeIp += 1)}`)
    .send({ email, password });

describe("Given the per-account login limiter with a limit of 2 failed attempts", () => {
  describe("When the same email fails from different IPs", () => {
    it("Then the third attempt responds 429 with RATE_LIMITED", async () => {
      const app = buildApp(2);
      await attempt(app, "isa@example.com");
      await attempt(app, "isa@example.com");

      const response = await attempt(app, "isa@example.com");

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        error: { code: "RATE_LIMITED", message: expect.any(String) },
      });
    });
  });

  describe("When the same email is written with different case or spaces", () => {
    it("Then it counts as the same account", async () => {
      const app = buildApp(2);
      await attempt(app, "isa@example.com");
      await attempt(app, "ISA@example.com");

      const response = await attempt(app, " Isa@Example.com ");

      expect(response.status).toBe(429);
    });
  });

  describe("When another email fails", () => {
    it("Then it is not blocked", async () => {
      const app = buildApp(2);
      await attempt(app, "isa@example.com");
      await attempt(app, "isa@example.com");

      const response = await attempt(app, "other@example.com");

      expect(response.status).toBe(401);
    });
  });

  describe("When the logins are successful", () => {
    it("Then they do not count", async () => {
      const app = buildApp(2);
      await attempt(app, "isa@example.com", CORRECT_PASSWORD);
      await attempt(app, "isa@example.com", CORRECT_PASSWORD);
      await attempt(app, "isa@example.com", CORRECT_PASSWORD);

      const response = await attempt(app, "isa@example.com");

      expect(response.status).toBe(401);
    });
  });

  describe("When the request has no email", () => {
    it("Then the limiter does not count it", async () => {
      const app = buildApp(1);
      await attempt(app, undefined);
      await attempt(app, undefined);

      const response = await attempt(app, "isa@example.com");

      expect(response.status).toBe(401);
    });
  });
});
