import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import handleCsrf from "../handleCsrf.js";
import handleError from "../handleError.js";

const buildApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(handleCsrf);
  app.get("/resource", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.post("/resource", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use(handleError);

  return app;
};

describe("Given the handleCsrf middleware", () => {
  describe("When a POST carries the X-CSRF-Token header equal to the csrfToken cookie", () => {
    it("Then it should let the request through", async () => {
      const response = await request(buildApp())
        .post("/resource")
        .set("Cookie", "csrfToken=abc")
        .set("X-CSRF-Token", "abc");

      expect(response.status).toBe(200);
    });
  });

  describe("When a POST carries a header different from the cookie", () => {
    it("Then it should respond 403 with CSRF_INVALID", async () => {
      const response = await request(buildApp())
        .post("/resource")
        .set("Cookie", "csrfToken=abc")
        .set("X-CSRF-Token", "xyz");

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
    });
  });

  describe("When a POST has the cookie but no header", () => {
    it("Then it should respond 403 with CSRF_INVALID", async () => {
      const response = await request(buildApp())
        .post("/resource")
        .set("Cookie", "csrfToken=abc");

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
    });
  });

  describe("When a POST has the header but no cookie", () => {
    it("Then it should respond 403 with CSRF_INVALID", async () => {
      const response = await request(buildApp())
        .post("/resource")
        .set("X-CSRF-Token", "abc");

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
    });
  });

  describe("When the request is a GET without any CSRF token", () => {
    it("Then it should let the request through", async () => {
      const response = await request(buildApp()).get("/resource");

      expect(response.status).toBe(200);
    });
  });
});
