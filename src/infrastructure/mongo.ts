import mongoose from "mongoose";

import { env } from "../config/env";
import { createScopedLogger } from "../utils/logger";

const mongoLogger = createScopedLogger("infrastructure.mongo");

const buildMongoConnectionUri = (): string => {
  const trimmedMongoUri = env.MONGO_URI.trim();
  const hasMongoProtocol =
    trimmedMongoUri.startsWith("mongodb://") ||
    trimmedMongoUri.startsWith("mongodb+srv://");
  const mongoUriWithProtocol = hasMongoProtocol
    ? trimmedMongoUri
    : `mongodb://${trimmedMongoUri}`;

  const parsedMongoUri = new URL(mongoUriWithProtocol);
  parsedMongoUri.username = encodeURIComponent(env.MONGO_USER);
  parsedMongoUri.password = encodeURIComponent(env.MONGO_PASSWORD);
  parsedMongoUri.pathname = `/${env.MONGO_DB}`;
  if (!parsedMongoUri.searchParams.has("authSource")) {
    parsedMongoUri.searchParams.set("authSource", "admin");
  }
  return parsedMongoUri.toString();
};

export const connectToInsightsDatabase = async (): Promise<typeof mongoose> => {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const uri = buildMongoConnectionUri();
  const connectedMongoose = await mongoose.connect(uri);

  mongoLogger.info("Connected to MongoDB", {
    db: env.MONGO_DB,
    readyState: connectedMongoose.connection.readyState,
  });

  return connectedMongoose;
};

export const disconnectFromInsightsDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 0) {
    return;
  }
  await mongoose.disconnect();
  mongoLogger.info("Disconnected from MongoDB");
};
