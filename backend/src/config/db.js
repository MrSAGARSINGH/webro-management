
import mongoose from "mongoose";
import { env } from "./env.js";

// ======================================
// MongoDB Configuration
// ======================================

const DB_OPTIONS = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 30000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
};

// ======================================
// Connection State
// ======================================

let connectionPromise = null;
let disconnectPromise = null;
let eventsRegistered = false;

// ======================================
// Register MongoDB Events
// ======================================

const registerConnectionEvents = () => {
  if (eventsRegistered) return;

  eventsRegistered = true;

  mongoose.connection.on("connected", () => {
    console.log("[MongoDB] Connection established");
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] Connection disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("[MongoDB] Connection restored");
  });

  mongoose.connection.on("error", (error) => {
    console.error(
      "[MongoDB] Connection error:",
      error.message
    );
  });
};

// ======================================
// Connect MongoDB
// ======================================

export const connectDB = async () => {
  if (!env.MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not configured"
    );
  }

  // Wait if an existing connection
  // is currently being disconnected.
  if (disconnectPromise) {
    await disconnectPromise;
  }

  // Reuse active connection.
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Prevent duplicate connection attempts.
  if (connectionPromise) {
    return connectionPromise;
  }

  registerConnectionEvents();

  const pendingConnection = (async () => {
    try {
      await mongoose.connect(
        env.MONGODB_URI,
        DB_OPTIONS
      );

      console.log(
        `[MongoDB] Database: ${mongoose.connection.name}`
      );

      return mongoose.connection;
    } catch (error) {
      console.error(
        "[MongoDB] Initial connection failed:",
        error.message
      );

      // Clean up a failed connection attempt.
      try {
        await mongoose.disconnect();
      } catch (cleanupError) {
        console.error(
          "[MongoDB] Connection cleanup failed:",
          cleanupError.message
        );
      }

      throw error;
    }
  })();

  connectionPromise = pendingConnection;

  try {
    return await pendingConnection;
  } finally {
    if (connectionPromise === pendingConnection) {
      connectionPromise = null;
    }
  }
};

// ======================================
// Disconnect MongoDB
// ======================================

export const disconnectDB = async () => {
  if (disconnectPromise) {
    return disconnectPromise;
  }

  const pendingDisconnect = (async () => {
    // Wait for an ongoing connection attempt.
    if (connectionPromise) {
      try {
        await connectionPromise;
      } catch {
        // Connection errors are handled in connectDB.
      }
    }

    // Already disconnected.
    if (mongoose.connection.readyState === 0) {
      return;
    }

    await mongoose.disconnect();

    console.log(
      "[MongoDB] Disconnected successfully"
    );
  })();

  disconnectPromise = pendingDisconnect;

  try {
    await pendingDisconnect;
  } finally {
    if (disconnectPromise === pendingDisconnect) {
      disconnectPromise = null;
    }
  }
};

// ======================================
// Database Connection Status
// ======================================

export const getDBStatus = () => {
  const state = mongoose.connection.readyState;

  const statusMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return {
    status: statusMap[state] ?? "unknown",
    connected: state === 1,
    database:
      state === 1
        ? mongoose.connection.name
        : null,
  };
};

// ======================================
// Export Mongoose Instance
// ======================================

export { mongoose };
