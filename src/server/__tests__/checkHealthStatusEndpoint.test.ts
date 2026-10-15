import request from "supertest";
import app from "../app.js";

describe("GET /", () => {
  it("Given el servidor arrancado, when se llama al endpoint de healthcheck, then responde 200 con pong", async () => {
    // Arrange / Act
    const response = await request(app).get("/");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "pong" });
  });
});
