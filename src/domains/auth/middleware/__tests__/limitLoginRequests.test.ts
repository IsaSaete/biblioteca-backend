import express from "express";
import request from "supertest";
import handleError from "../../../../middleware/handleError.js";
import { createLoginRateLimiter } from "../limitLoginRequests.js";

const CORRECT_PASSWORD = "right";

// Simula un login: acierta solo con la contraseña correcta.
const buildApp = (limit: number) => {
  const app = express();
  app.use(express.json());
  app.post("/login", createLoginRateLimiter({ limit }), (req, res) => {
    res.status(req.body.password === CORRECT_PASSWORD ? 200 : 401).json({});
  });
  app.use(handleError);

  return app;
};

const attempt = (app: express.Express, email: string, password = "wrong") =>
  request(app).post("/login").send({ email, password });

describe("Given the login rate limiter with a limit of 2 failed attempts", () => {
  describe("When the same email fails twice and tries a third time", () => {
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

  describe("When the same email is written with different case", () => {
    it("Then it counts as the same key", async () => {
      const app = buildApp(2);
      await attempt(app, "isa@example.com");
      await attempt(app, "ISA@example.com");

      const response = await attempt(app, " Isa@Example.com");

      expect(response.status).toBe(429);
    });
  });

  describe("When another email is used from the same IP", () => {
    it("Then it is not blocked", async () => {
      const app = buildApp(2);
      await attempt(app, "isa@example.com");
      await attempt(app, "isa@example.com");

      const response = await attempt(app, "other@example.com");

      expect(response.status).toBe(401);
    });
  });

  describe("When the attempts are successful", () => {
    it("Then they do not count towards the limit", async () => {
      const app = buildApp(2);
      await attempt(app, "isa@example.com", CORRECT_PASSWORD);
      await attempt(app, "isa@example.com", CORRECT_PASSWORD);
      await attempt(app, "isa@example.com", CORRECT_PASSWORD);

      const response = await attempt(app, "isa@example.com", CORRECT_PASSWORD);

      expect(response.status).toBe(200);
    });
  });
});
