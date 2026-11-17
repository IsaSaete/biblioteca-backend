import express from "express";
import request from "supertest";
import handleError from "../../../../middleware/handleError.js";
import { createVerificationEmailRateLimiter } from "../limitVerificationEmailRequests.js";

const buildApp = (limit: number) => {
  const app = express();
  app.use((req, _res, next) => {
    req.userId = req.get("x-user");
    next();
  });
  app.post(
    "/verification-email",
    createVerificationEmailRateLimiter({ limit }),
    (_req, res) => {
      res.status(202).end();
    },
  );
  app.use(handleError);

  return app;
};

const ask = (app: express.Express, user: string) =>
  request(app).post("/verification-email").set("x-user", user);

describe("Given the verification email rate limiter with a limit of 2 requests", () => {
  describe("When the same user sends a third request", () => {
    it("Then it responds 429 with the RATE_LIMITED error format", async () => {
      const app = buildApp(2);
      await ask(app, "user-1");
      await ask(app, "user-1");

      const response = await ask(app, "user-1");

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        error: { code: "RATE_LIMITED", message: expect.any(String) },
      });
    });
  });

  describe("When another user is on the same IP", () => {
    it("Then they are not blocked", async () => {
      const app = buildApp(1);
      await ask(app, "user-1");

      const response = await ask(app, "user-2");

      expect(response.status).toBe(202);
    });
  });
});
