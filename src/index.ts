import "dotenv/config";
import config from "./config/index.js";
import connectToDatabase from "./database/connectToDatabase.js";
import logger from "./utils/logger.js";
import startServer from "./server/startServer.js";

const main = async (): Promise<void> => {
  await connectToDatabase();
  startServer(config.port);
};

main().catch((error: unknown) => {
  logger.error(error, "Failed to start the server");
  process.exit(1);
});
