import request from "supertest";
import app from "../app.js";

describe("Given the GET / endpoint", () => {
  describe("When it receives a request", () => {
    test("Then it should respond with status 200 and the message 'pong'", async () => {
      const expectedStatus = 200;
      const expectedBody = { message: "pong" };

      const response = await request(app).get("/");

      expect(response.status).toBe(expectedStatus);
      expect(response.body).toEqual(expectedBody);
    });
  });
});
