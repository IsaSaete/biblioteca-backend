import express from "express";
import request from "supertest";
import { createHandleCors } from "../handleCors.js";

const netlify = "https://glosa-app.netlify.app";
const localhost = "http://localhost:5173";

const buildApp = () => {
  const app = express();
  app.use(createHandleCors([netlify, localhost]));
  app.get("/", (_req, res) => {
    res.json({ message: "pong" });
  });

  return app;
};

describe("Given the CORS middleware allowing Netlify and localhost", () => {
  describe.each([netlify, localhost])(
    "When a request comes from the allowed origin %s",
    (origin) => {
      it("Then it is answered with that exact origin and credentials allowed", async () => {
        const app = buildApp();

        const response = await request(app).get("/").set("Origin", origin);

        expect(response.headers["access-control-allow-origin"]).toBe(origin);
        expect(response.headers["access-control-allow-credentials"]).toBe(
          "true",
        );
      });
    },
  );

  describe("When a preflight comes from an allowed origin", () => {
    it("Then it is accepted", async () => {
      const app = buildApp();

      const response = await request(app)
        .options("/")
        .set("Origin", localhost)
        .set("Access-Control-Request-Method", "POST");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(localhost);
    });
  });

  describe("When a request comes from an origin that is not allowed", () => {
    it("Then no CORS headers are sent", async () => {
      const app = buildApp();

      const response = await request(app)
        .get("/")
        .set("Origin", "https://evil.example");

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });
});
