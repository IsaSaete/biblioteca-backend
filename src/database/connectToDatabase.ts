import mongoose from "mongoose";
import config from "../config/index.js";
import logger from "../utils/logger.js";

const connectToDatabase = async (): Promise<void> => {
  await mongoose.connect(config.mongodbUri);
  logger.info("Connected to MongoDB");
};

export default connectToDatabase;
