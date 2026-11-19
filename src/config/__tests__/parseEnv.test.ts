import { parseEnv } from "../index.js";

const validEnv = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/test",
  FRONTEND_URL: "http://localhost:5173",
  ACCESS_TOKEN_SECRET: "test-access-token-secret-0123456789",
  REFRESH_TOKEN_SECRET: "test-refresh-token-secret-0123456789",
  RESEND: "test-resend-key",
  GOOGLE_BOOKS_API_KEY: "test-google-books-key",
};

describe("Given the environment reader", () => {
  describe("When NODE_ENV is not defined", () => {
    it("Then it assumes production, so a deployment never ends up in debug mode by omission", () => {
      const result = parseEnv(validEnv);

      expect(result.success).toBe(true);
      expect(result.data?.NODE_ENV).toBe("production");
    });
  });

  describe("When NODE_ENV is asked for explicitly", () => {
    it.each(["development", "test", "production"] as const)(
      "Then %s is kept",
      (nodeEnv) => {
        const result = parseEnv({ ...validEnv, NODE_ENV: nodeEnv });

        expect(result.data?.NODE_ENV).toBe(nodeEnv);
      },
    );
  });

  describe("When NODE_ENV is not one of the known values", () => {
    it.each(["staging", ""])("Then %j is rejected", (nodeEnv) => {
      const result = parseEnv({ ...validEnv, NODE_ENV: nodeEnv });

      expect(result.success).toBe(false);
    });
  });
});
