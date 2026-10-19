declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    NODE_ENV?: string;
    DEBUG?: string;
    MONGODB_URI?: string;
    FRONTEND_URL?: string;
    EXTRA_ALLOWED_ORIGINS?: string;
    ACCESS_TOKEN_SECRET?: string;
    REFRESH_TOKEN_SECRET?: string;
    RESEND?: string;
    GOOGLE_BOOKS_API_KEY?: string;
  }
}
