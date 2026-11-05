import { Writable } from "node:stream";
import pino from "pino";
import { logRedaction } from "../logger.js";

const logOnce = (entry: object): string => {
  let output = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });

  pino({ redact: logRedaction }, stream).info(entry);

  return output;
};

describe("Given the logger redaction", () => {
  describe("When a request with session cookies and tokens is logged", () => {
    it("Then the secrets are replaced and the rest of the headers are kept", () => {
      const output = logOnce({
        req: {
          headers: {
            cookie: "accessToken=SECRET-JWT; csrfToken=SECRET-CSRF",
            authorization: "Bearer SECRET-BEARER",
            "x-csrf-token": "SECRET-CSRF-HEADER",
            "user-agent": "Mozilla/5.0",
            "x-forwarded-for": "1.2.3.4, 10.0.0.1",
          },
        },
        res: { headers: { "set-cookie": ["refreshToken=SECRET-REFRESH"] } },
      });

      expect(output).not.toContain("SECRET");
      expect(output).toContain("[Redacted]");
      expect(output).toContain("Mozilla/5.0");
      expect(output).toContain("1.2.3.4, 10.0.0.1");
    });
  });
});
