
import { env } from "./config/env.js";

// ======================================
// Start Express Application
// ======================================

// Import the application only after
// environment validation succeeds.

const { default: app } = await import("./app.js");

let server;

// ======================================
// Start HTTP Server
// ======================================

const startServer = () => {
  server = app.listen(env.PORT, () => {
    console.log(
      "\n=================================="
    );

    console.log(
      "WEBRO MANAGEMENT BACKEND"
    );

    console.log(
      "=================================="
    );

    console.log(
      `Environment: ${env.NODE_ENV}`
    );

    console.log(
      `Server: http://localhost:${env.PORT}`
    );

    console.log(
      `Health: http://localhost:${env.PORT}/api/health`
    );

    console.log(
      "==================================\n"
    );
  });

  // ======================================
  // Server Startup Errors
  // ======================================

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${env.PORT} is already in use.`
      );
    } else if (error.code === "EACCES") {
      console.error(
        `Permission denied for port ${env.PORT}.`
      );
    } else {
      console.error(
        "Server startup failed:",
        error
      );
    }

    process.exitCode = 1;
  });

  // ======================================
  // Server Timeout Configuration
  // ======================================

  server.requestTimeout = 120_000;
  server.headersTimeout = 60_000;
  server.keepAliveTimeout = 5_000;
};

// ======================================
// Graceful Shutdown
// ======================================

let isShuttingDown = false;

const shutdown = (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(
    `\nReceived ${signal}. Shutting down...`
  );

  if (!server || !server.listening) {
    process.exit(0);
  }

  const forceShutdown = setTimeout(() => {
    console.error(
      "Graceful shutdown timed out."
    );

    server.closeAllConnections();

    process.exit(1);
  }, 10_000);

  forceShutdown.unref();

  server.close((error) => {
    clearTimeout(forceShutdown);

    if (error) {
      console.error(
        "Server shutdown failed:",
        error
      );

      process.exit(1);
    }

    console.log(
      "WEBRO backend stopped successfully."
    );

    process.exit(0);
  });

  server.closeIdleConnections();
};

// ======================================
// Process Signal Handlers
// ======================================

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

// ======================================
// Unhandled Promise Rejections
// ======================================

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "Unhandled promise rejection:",
      reason
    );

    shutdown("UNHANDLED_REJECTION");
  }
);

// ======================================
// Uncaught Exceptions
// ======================================

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught exception:",
      error
    );

    shutdown("UNCAUGHT_EXCEPTION");
  }
);

// ======================================
// Start Application
// ======================================

startServer();
