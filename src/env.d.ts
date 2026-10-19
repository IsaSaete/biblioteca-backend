declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    NODE_ENV?: string;
    DEBUG?: string;
    MONGODB_URI?: string;
    FRONTEND_URL?: string;
    EXTRA_ALLOWED_ORIGINS?: string;
    COOKIE_SAME_SITE?: string;
    API_PUBLIC_PATH_PREFIX?: string;
    TRUST_PROXY_HOPS?: string;
    ACCESS_TOKEN_SECRET?: string;
    REFRESH_TOKEN_SECRET?: string;
    RESEND?: string;
    GOOGLE_BOOKS_API_KEY?: string;
  }
}
