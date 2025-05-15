/**
 * Graceful shutdown utilities
 * Handles clean application shutdown processes
 */
import http from "http";
import { closeDatabaseConnection } from "../db/connection";
import { API } from "../constants";

// Track shutdown state
let isShuttingDown = false;

/**
 * Performs a graceful shutdown of the application
 * Closes all connections and resources before exiting
 *
 * @param exitCode - The exit code to use when terminating the process
 * @param reason - The reason for shutdown (for logging)
 * @param services - Optional object containing services that need to be stopped
 */
export async function performGracefulShutdown(
  exitCode: number,
  reason: string,
  services: {
    phaseTransitionService?: { stop: () => void };
    server?: http.Server | null;
  } = {}
): Promise<void> {
  if (isShuttingDown) return; // Prevent multiple shutdown attempts
  isShuttingDown = true;

  console.log(`Initiating graceful shutdown: ${reason}`);

  try {
    // Stop the phase transition service if it's running
    if (services.phaseTransitionService) {
      console.log("Stopping phase transition service...");
      services.phaseTransitionService.stop();
    }

    // Close HTTP server if running
    if (services.server) {
      console.log("Closing HTTP server...");
      await new Promise<void>((resolve) => {
        services.server!.close(() => resolve());
      });
    }

    // Close database connection
    console.log("Closing database connection...");
    await closeDatabaseConnection();

    console.log(`Graceful shutdown completed. Exiting with code ${exitCode}`);
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
  } finally {
    // Force exit after timeout to prevent hanging
    setTimeout(() => {
      console.error("Forced exit after shutdown timeout");
      process.exit(exitCode);
    }, API.SHUTDOWN_TIMEOUT_MS).unref();

    process.exit(exitCode);
  }
}

/**
 * Registers handlers for termination signals
 *
 * @param services - Object containing services that need to be stopped on shutdown
 */
export function registerTerminationHandlers(
  services: {
    phaseTransitionService?: { stop: () => void };
    server?: http.Server | null;
  } = {}
): void {
  // Handle termination signals
  ["SIGINT", "SIGTERM"].forEach((signal) => {
    process.on(signal, () => {
      console.log(`\n${signal} received. Performing graceful shutdown...`);
      performGracefulShutdown(0, signal, services);
    });
  });

  // Global error handlers
  process.on("uncaughtException", (error) => {
    console.error("[CRITICAL] Uncaught Exception:", error);
    performGracefulShutdown(1, "Uncaught Exception", services);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error(
      "[CRITICAL] Unhandled Rejection at:",
      promise,
      "reason:",
      reason
    );
    // We don't exit here as it might be recoverable
  });
}
