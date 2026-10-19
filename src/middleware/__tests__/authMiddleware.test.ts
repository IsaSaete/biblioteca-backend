import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import authMiddleware from "../authMiddleware.js";
import handleError from "../handleError.js";
import { createAccessToken } from "../../utils/tokens.js";

const buildApp = () => {
  const app = express();
  app.use(cookieParser());
  app.get("/protected", authMiddleware, (req, res) => {
    res.status(200).json({ userId: req.userId });
  });
  app.use(handleError);

  return app;
};

describe("Given the authMiddleware", () => {
  describe("When the request carries a valid accessToken cookie", () => {
    it("Then it should expose the userId and let the request through", async () => {
      const token = createAccessToken({ userId: "user-1" });

      const response = await request(buildApp())
        .get("/protected")
        .set("Cookie", `accessToken=${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ userId: "user-1" });
    });
  });

  describe("When the request has no accessToken cookie", () => {
    it("Then it should respond 401 with AUTH_UNAUTHENTICATED", async () => {
      const response = await request(buildApp()).get("/protected");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the accessToken cookie is invalid", () => {
    it("Then it should respond 401 with AUTH_UNAUTHENTICATED", async () => {
      const response = await request(buildApp())
        .get("/protected")
        .set("Cookie", "accessToken=garbage");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });
});
