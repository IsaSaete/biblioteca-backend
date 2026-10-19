import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI es obligatoria"),
  FRONTEND_URL: z.url("FRONTEND_URL debe ser una URL válida"),
  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32, "ACCESS_TOKEN_SECRET debe tener al menos 32 caracteres"),
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, "REFRESH_TOKEN_SECRET debe tener al menos 32 caracteres"),
  RESEND: z.string().min(1, "RESEND es obligatoria"),
  GOOGLE_BOOKS_API_KEY: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(
    `Variables de entorno inválidas o ausentes:\n${issues}\n\nRevisa tu archivo .env contra .env.example.`,
  );
}

const env = parsedEnv.data;

const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  mongodbUri: env.MONGODB_URI,
  frontendUrl: env.FRONTEND_URL,
  accessTokenSecret: env.ACCESS_TOKEN_SECRET,
  refreshTokenSecret: env.REFRESH_TOKEN_SECRET,
  resendApiKey: env.RESEND,
  googleBooksApiKey: env.GOOGLE_BOOKS_API_KEY,
};

export default config;
