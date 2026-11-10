import express from "express";
import request from "supertest";
import handleError from "../../../../middleware/handleError.js";
import { createForgotPasswordAccountRateLimiter } from "../limitForgotPasswordPerAccount.js";

const buildApp = (limit: number) => {
  const app = express();
  app.use(express.json());
  app.post(
    "/forgot-password",
    createForgotPasswordAccountRateLimiter({ limit }),
    (_req, res) => {
      res.status(200).json({});
    },
  );
  app.use(handleError);

  return app;
};

let fakeIp = 0;
const ask = (app: express.Express, email: unknown) =>
  request(app)
    .post("/forgot-password")
    .set("X-Forwarded-For", `10.0.0.${(fakeIp += 1)}`)
    .send({ email });

describe("Given the per-account forgot-password limiter with a limit of 2", () => {
  describe("When the same email is asked three times from different IPs", () => {
    it("Then the third request responds 429 with RATE_LIMITED", async () => {
      const app = buildApp(2);
      await ask(app, "isa@example.com");
      await ask(app, " ISA@example.com");

      const response = await ask(app, "isa@example.com");

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        error: { code: "RATE_LIMITED", message: expect.any(String) },
      });
    });
  });

  describe("When another email is asked", () => {
    it("Then it is not blocked", async () => {
      const app = buildApp(2);
      await ask(app, "isa@example.com");
      await ask(app, "isa@example.com");

      const response = await ask(app, "other@example.com");

      expect(response.status).toBe(200);
    });
  });

  describe("When the request has no email", () => {
    it("Then the limiter does not count it", async () => {
      const app = buildApp(1);
      await ask(app, undefined);
      await ask(app, undefined);

      const response = await ask(app, "isa@example.com");

      expect(response.status).toBe(200);
    });
  });
});
