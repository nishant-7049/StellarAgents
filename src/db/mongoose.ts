import mongoose from "mongoose";
import { config } from "../config.js";
import { logger } from "../logger.js";

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) return; // already connected

  try {
    await mongoose.connect(config.MONGODB_URI);
    logger.info("MongoDB connected");
  } catch (err) {
    logger.error("MongoDB connection failed", { err });
    process.exit(1);
  }
}
