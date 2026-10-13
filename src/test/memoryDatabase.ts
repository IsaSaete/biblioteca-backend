import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let memoryServer: MongoMemoryServer | undefined;

// Base de datos MongoDB en memoria, aislada por test run: evita que los
// tests unitarios y de integración toquen una base de datos real.
export const connectToMemoryDatabase = async (): Promise<void> => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
};

export const clearMemoryDatabase = async (): Promise<void> => {
  const { collections } = mongoose.connection;

  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );
};

export const disconnectMemoryDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  await memoryServer?.stop();
};
