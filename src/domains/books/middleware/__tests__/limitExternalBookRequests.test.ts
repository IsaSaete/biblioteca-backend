import express from "express";
import request from "supertest";
import handleError from "../../../../middleware/handleError.js";
import { createExternalBooksRateLimiter } from "../limitExternalBookRequests.js";

// Simula las rutas externas con dos usuarios de sesión distintos que comparten IP.
const buildApp = (limit: number) => {
  const app = express();
  app.use((req, _res, next) => {
    req.userId = req.get("X-Test-User");
    next();
  });
  app.get("/lookup", createExternalBooksRateLimiter({ limit }), (_req, res) => {
    res.status(200).json({});
  });
  app.use(handleError);

  return app;
};

const lookup = (app: express.Express, userId: string) =>
  request(app).get("/lookup").set("X-Test-User", userId);

describe("Given the external books rate limiter with a limit of 2 per window", () => {
  describe("When the same user makes a third request", () => {
    it("Then it should respond 429 with RATE_LIMITED", async () => {
      const app = buildApp(2);
      await lookup(app, "user-a");
      await lookup(app, "user-a");

      const response = await lookup(app, "user-a");

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        error: { code: "RATE_LIMITED", message: expect.any(String) },
      });
    });
  });

  describe("When another user shares the IP of a blocked user", () => {
    it("Then the other user should not be blocked", async () => {
      const app = buildApp(2);
      await lookup(app, "user-a");
      await lookup(app, "user-a");
      await lookup(app, "user-a");

      const response = await lookup(app, "user-b");

      expect(response.status).toBe(200);
    });
  });
});
