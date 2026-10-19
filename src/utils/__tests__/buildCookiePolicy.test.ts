import { buildCookiePolicy } from "../buildCookiePolicy.js";

describe("Given the cookie policy of the session", () => {
  describe("When the API is called directly from another origin", () => {
    it("Then cookies are SameSite=None and the refresh path is the endpoint path", () => {
      const input = { sameSite: "none", publicPathPrefix: "" } as const;

      const result = buildCookiePolicy(input);

      expect(result).toEqual({
        sameSite: "none",
        refreshTokenPath: "/auth/refresh",
      });
    });
  });

  describe("When the API is served behind the frontend proxy under /api", () => {
    it("Then the refresh cookie is limited to the path the browser sees", () => {
      const input = { sameSite: "lax", publicPathPrefix: "/api" } as const;

      const result = buildCookiePolicy(input);

      expect(result).toEqual({
        sameSite: "lax",
        refreshTokenPath: "/api/auth/refresh",
      });
    });
  });
});
