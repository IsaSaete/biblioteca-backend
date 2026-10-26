import express from "express";
import request from "supertest";
import handleError from "../../../../middleware/handleError.js";
import { createWrongPasswordRateLimiter } from "../limitWrongPasswordAttempts.js";

const CORRECT_PASSWORD = "right";

// Simula dos endpoints protegidos por la contraseña que comparten limitador.
// `x-user` hace de userId; la contraseña vacía simula un 400 de validación.
const buildApp = (limit: number) => {
  const app = express();
  const limiter = createWrongPasswordRateLimiter({ limit });
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = req.get("x-user");
    next();
  });
  app.post("/first", limiter, (req, res) => {
    const { password } = req.body;
    const status = !password ? 400 : password === CORRECT_PASSWORD ? 204 : 401;
    res.status(status).json({});
  });
  app.post("/second", limiter, (req, res) => {
    res.status(req.body.password === CORRECT_PASSWORD ? 204 : 401).json({});
  });
  app.use(handleError);

  return app;
};

const attempt = (
  app: express.Express,
  user: string,
  password = "wrong",
  path = "/first",
) => request(app).post(path).set("x-user", user).send({ password });

describe("Given the wrong password rate limiter with a limit of 2 attempts", () => {
  describe("When the same user fails twice and tries a third time", () => {
    it("Then the third attempt responds 429 with RATE_LIMITED", async () => {
      const app = buildApp(2);
      await attempt(app, "user-1");
      await attempt(app, "user-1");

      const response = await attempt(app, "user-1");

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        error: { code: "RATE_LIMITED", message: expect.any(String) },
      });
    });
  });

  describe("When the failures happen on different endpoints", () => {
    it("Then they share the same counter", async () => {
      const app = buildApp(2);
      await attempt(app, "user-1", "wrong", "/first");
      await attempt(app, "user-1", "wrong", "/second");

      const response = await attempt(app, "user-1", "wrong", "/first");

      expect(response.status).toBe(429);
    });
  });

  describe("When another user is on the same IP", () => {
    it("Then they are not blocked", async () => {
      const app = buildApp(2);
      await attempt(app, "user-1");
      await attempt(app, "user-1");

      const response = await attempt(app, "user-2");

      expect(response.status).toBe(401);
    });
  });

  describe("When the attempts use the right password", () => {
    it("Then they do not count towards the limit", async () => {
      const app = buildApp(2);
      await attempt(app, "user-1", CORRECT_PASSWORD);
      await attempt(app, "user-1", CORRECT_PASSWORD);
      await attempt(app, "user-1", CORRECT_PASSWORD);

      const response = await attempt(app, "user-1", CORRECT_PASSWORD);

      expect(response.status).toBe(204);
    });
  });

  describe("When the requests fail validation instead of the password", () => {
    it("Then they do not count towards the limit", async () => {
      const app = buildApp(2);
      await attempt(app, "user-1", "");
      await attempt(app, "user-1", "");
      await attempt(app, "user-1", "");

      const response = await attempt(app, "user-1");

      expect(response.status).toBe(401);
    });
  });
});
