import express from "express";
import request from "supertest";
import handleError from "../../../../middleware/handleError.js";
import { createRegisterRateLimiter } from "../limitRegisterRequests.js";

const buildApp = (limit: number) => {
  const app = express();
  app.post("/register", createRegisterRateLimiter({ limit }), (_req, res) => {
    res.status(201).json({ ok: true });
  });
  app.use(handleError);

  return app;
};

describe("Given the register rate limiter with a limit of 2 requests", () => {
  describe("When the same client sends 2 requests", () => {
    it("Then both are allowed", async () => {
      const app = buildApp(2);

      const first = await request(app).post("/register");
      const second = await request(app).post("/register");

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
    });
  });

  describe("When the same client sends a third request", () => {
    it("Then it responds 429 with the RATE_LIMITED error format", async () => {
      const app = buildApp(2);
      await request(app).post("/register");
      await request(app).post("/register");

      const response = await request(app).post("/register");

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        error: {
          code: "RATE_LIMITED",
          message: expect.any(String),
        },
      });
    });
  });
});
