declare namespace Express {
  interface Request {
    // Lo rellena authMiddleware a partir del accessToken verificado.
    userId?: string;
  }
}
