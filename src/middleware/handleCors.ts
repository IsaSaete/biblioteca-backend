import cors from "cors";
import config from "../config/index.js";

// `origin` recibe una lista de orígenes exactos (nunca comodín: no es
// compatible con `credentials: true`). Un origen fuera de la lista no recibe
// cabeceras CORS y el navegador bloquea la petición.
export const createHandleCors = (allowedOrigins: string[]) =>
  cors({
    origin: allowedOrigins,
    credentials: true,
  });

const handleCors = createHandleCors(config.allowedOrigins);

export default handleCors;
