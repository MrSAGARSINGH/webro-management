import "./config/dns.js";
import { env } from "./config/env.js";

// ======================================
// WEBRO Management Backend
// ======================================

// Load application only after environment
// configuration has been validated.

const [{ default: app }, { connectDB, disconnectDB }] =
  await Promise.all([
    import("./app.js"),
    import("./config/db.js"),
  ]);

// ======================================
// Server State
// ======================================

let server = null;
let isShuttingDown = false;
let shutdownPromise = null;

// ======================================
// Server Configuration
// ======================================

const configureServer = (httpServer) => {
  httpServer.requestTimeout = 120_000;
  httpServer.headersTimeout = 60_000;
  httpServer.keepAliveTimeout = 5_000;
};

// ======================================
// Close HTTP Server
// ======================================

const closeHTTPServer = async () => {
  if (!server) return;

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
        reject(error);
        return;
      }

      resolve();
    });

    server.closeIdleConnections?.();
  });
};

// ======================================
// Graceful Shutdown
// ======================================

const shutdown = (signal, exitCode = 0) => {
  if (shutdownPromise) {
    if (exitCode !== 0) {
      process.exitCode = 1;
    }

    return shutdownPromise;
  }

  isShuttingDown = true;
  process.exitCode = exitCode;

  console.log(
    `\n[WEBRO] Received ${signal}. Shutting down...`
  );

  shutdownPromise = (async () => {
    const forceShutdown = setTimeout(() => {
      console.error(
        "[WEBRO] Graceful shutdown timed out"
      );

      server?.closeAllConnections?.();
      process.exit(1);
    }, 10_000);

    forceShutdown.unref();

    try {
      await closeHTTPServer();
      await disconnectDB();

      console.log(
        "[WEBRO] Backend stopped successfully"
      );
    } catch (error) {
      console.error(
        "[WEBRO] Shutdown failed:",
        error
      );

      process.exitCode = 1;
    } finally {
      clearTimeout(forceShutdown);
    }
  })();

  return shutdownPromise;
};

// ======================================
// Start HTTP Server
// ======================================

const listen = () =>
  new Promise((resolve, reject) => {
    const httpServer = app.listen(env.PORT);

    server = httpServer;
    configureServer(httpServer);

    const onListening = () => {
      httpServer.off("error", onStartupError);
      resolve(httpServer);
    };

    const onStartupError = (error) => {
      httpServer.off("listening", onListening);
      reject(error);
    };

    httpServer.once("listening", onListening);
    httpServer.once("error", onStartupError);
  });

// ======================================
// Start Backend
// ======================================

const startServer = async () => {
  try {
    console.log("[WEBRO] Connecting to MongoDB...");

    // Do not accept HTTP requests until
    // the database connection succeeds.

    await connectDB();

    if (isShuttingDown) return;

    await listen();

    if (isShuttingDown) return;

    // Handle runtime HTTP server errors.

    server.on("error", (error) => {
      console.error(
        "[WEBRO] HTTP server error:",
        error
      );

      void shutdown("SERVER_ERROR", 1);
    });

    console.log(
      "\n=================================="
    );
    console.log("WEBRO MANAGEMENT BACKEND");
    console.log(
      "=================================="
    );
    console.log(
      `Environment: ${env.NODE_ENV}`
    );
    console.log("MongoDB: Connected");
    console.log(
      `Server: http://localhost:${env.PORT}`
    );
    console.log(
      `Health: http://localhost:${env.PORT}/api/health`
    );
    console.log(
      "==================================\n"
    );
  } catch (error) {
    if (error.code === "EADDRINUSE") {
      console.error(
        `[WEBRO] Port ${env.PORT} is already in use`
      );
    } else if (error.code === "EACCES") {
      console.error(
        `[WEBRO] Permission denied for port ${env.PORT}`
      );
    } else {
      console.error(
        "[WEBRO] Backend startup failed:",
        error.message
      );
    }

    await shutdown("STARTUP_FAILURE", 1);
  }
};

// ======================================
// Process Signal Handlers
// ======================================

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

// ======================================
// Unhandled Promise Rejections
// ======================================

process.on("unhandledRejection", (reason) => {
  console.error(
    "[WEBRO] Unhandled promise rejection:",
    reason
  );

  void shutdown("UNHANDLED_REJECTION", 1);
});

// ======================================
// Uncaught Exceptions
// ======================================

process.on("uncaughtException", (error) => {
  console.error(
    "[WEBRO] Uncaught exception:",
    error
  );

  void shutdown("UNCAUGHT_EXCEPTION", 1);
});

// ======================================
// Start Application
// ======================================

await startServer();
