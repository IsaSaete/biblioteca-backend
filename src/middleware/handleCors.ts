import cors from "cors";
import config from "../config/index.js";

const handleCors = cors({
  origin: config.frontendUrl,
  credentials: true,
});

export default handleCors;
