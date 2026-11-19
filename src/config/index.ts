import { z } from "zod";
import { buildCookiePolicy } from "../utils/buildCookiePolicy.js";
import { parseAllowedOrigins } from "./parseAllowedOrigins.js";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  // Si falta, se asume producción: un despliegue sin la variable no debe acabar
  // con el registro de depuración, que escribe en los logs los enlaces con token
  // de verificación y recuperación. En local se pide `development` expresamente.
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI es obligatoria"),
  FRONTEND_URL: z.url("FRONTEND_URL debe ser una URL válida"),
  EXTRA_ALLOWED_ORIGINS: z.string().optional(),
  // Cómo llega la API al navegador. Por defecto, directa desde otro origen
  // (cookies SameSite=None). Detrás del proxy del frontend: COOKIE_SAME_SITE=lax,
  // API_PUBLIC_PATH_PREFIX=/api y TRUST_PROXY_HOPS con los saltos reales.
  COOKIE_SAME_SITE: z.enum(["none", "lax", "strict"]).default("none"),
  API_PUBLIC_PATH_PREFIX: z
    .string()
    .regex(
      /^(\/[a-z0-9-]+)*$/,
      "API_PUBLIC_PATH_PREFIX debe ser vacío o una ruta como /api, sin barra final",
    )
    .default(""),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(1).max(5).default(1),
  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32, "ACCESS_TOKEN_SECRET debe tener al menos 32 caracteres"),
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, "REFRESH_TOKEN_SECRET debe tener al menos 32 caracteres"),
  RESEND: z.string().min(1, "RESEND es obligatoria"),
  // Quién firma los correos y a dónde llegan las respuestas. El dominio del
  // remitente debe estar verificado en Resend.
  EMAIL_FROM: z.string().min(1).default("Glosa <no-reply@glosaapp.com>"),
  EMAIL_REPLY_TO: z.email().default("contacto@glosaapp.com"),
  GOOGLE_BOOKS_API_KEY: z
    .string()
    .min(1, "GOOGLE_BOOKS_API_KEY es obligatoria"),
});

export const parseEnv = (source: NodeJS.ProcessEnv) =>
  envSchema
    .superRefine((env, context) => {
      try {
        parseAllowedOrigins(env.FRONTEND_URL, env.EXTRA_ALLOWED_ORIGINS);
      } catch {
        context.addIssue({
          code: "custom",
          path: ["EXTRA_ALLOWED_ORIGINS"],
          message:
            "EXTRA_ALLOWED_ORIGINS debe ser una lista de URLs http(s) exactas separadas por comas, sin comodines",
        });
      }
    })
    .safeParse(source);

const parsedEnv = parseEnv(process.env);

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
  allowedOrigins: parseAllowedOrigins(
    env.FRONTEND_URL,
    env.EXTRA_ALLOWED_ORIGINS,
  ),
  accessTokenSecret: env.ACCESS_TOKEN_SECRET,
  refreshTokenSecret: env.REFRESH_TOKEN_SECRET,
  resendApiKey: env.RESEND,
  emailFrom: env.EMAIL_FROM,
  emailReplyTo: env.EMAIL_REPLY_TO,
  googleBooksApiKey: env.GOOGLE_BOOKS_API_KEY,
  cookiePolicy: buildCookiePolicy({
    sameSite: env.COOKIE_SAME_SITE,
    publicPathPrefix: env.API_PUBLIC_PATH_PREFIX,
  }),
  trustProxyHops: env.TRUST_PROXY_HOPS,
};

export default config;
