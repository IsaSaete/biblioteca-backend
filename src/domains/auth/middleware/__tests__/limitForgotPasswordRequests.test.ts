import express from "express";
import request from "supertest";
import handleError from "../../../../middleware/handleError.js";
import { createForgotPasswordRateLimiter } from "../limitForgotPasswordRequests.js";

const buildApp = (limit: number) => {
  const app = express();
  app.post(
    "/forgot-password",
    createForgotPasswordRateLimiter({ limit }),
    (_req, res) => {
      res.status(200).end();
    },
  );
  app.use(handleError);

  return app;
};

describe("Given the forgot-password rate limiter with a limit of 2 requests", () => {
  describe("When the same client sends a third request", () => {
    it("Then it responds 429 with the RATE_LIMITED error format", async () => {
      const app = buildApp(2);
      await request(app).post("/forgot-password");
      await request(app).post("/forgot-password");

      const response = await request(app).post("/forgot-password");

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        error: { code: "RATE_LIMITED", message: expect.any(String) },
      });
    });
  });
});
