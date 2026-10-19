// Valores ficticios para que `config` valide al importarse en los tests sin
// depender del .env real (mismos valores que inyecta el workflow de CI).
process.env.NODE_ENV = "test";
process.env.PORT = process.env.PORT ?? "4000";
process.env.MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/test";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
process.env.ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET ?? "test-access-token-secret-0123456789";
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET ?? "test-refresh-token-secret-0123456789";
process.env.RESEND = process.env.RESEND ?? "test-resend-key";
