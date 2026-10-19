import { parseAllowedOrigins } from "../parseAllowedOrigins.js";

const frontendUrl = "https://glosa-app.netlify.app";

describe("Given the allowed origins configuration", () => {
  describe("When there are no extra origins", () => {
    it("Then only the frontend origin is allowed", () => {
      const result = parseAllowedOrigins(frontendUrl);

      expect(result).toEqual(["https://glosa-app.netlify.app"]);
    });
  });

  describe("When extra origins are given separated by commas", () => {
    it("Then they are added to the frontend origin without duplicates or spaces", () => {
      const extra = " http://localhost:5173 , https://glosa-app.netlify.app,,";

      const result = parseAllowedOrigins(frontendUrl, extra);

      expect(result).toEqual([
        "https://glosa-app.netlify.app",
        "http://localhost:5173",
      ]);
    });
  });

  describe("When the frontend URL has a trailing slash or a path", () => {
    it("Then it is reduced to its exact origin", () => {
      const result = parseAllowedOrigins("https://glosa-app.netlify.app/app/");

      expect(result).toEqual(["https://glosa-app.netlify.app"]);
    });
  });

  describe("When an extra origin is a wildcard or not a web URL", () => {
    it.each(["*", "not a url", "ftp://example.com"])(
      "Then it is rejected: %s",
      (extra) => {
        const act = () => parseAllowedOrigins(frontendUrl, extra);

        expect(act).toThrow();
      },
    );
  });
});
