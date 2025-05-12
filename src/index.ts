import { App, ExpressReceiver } from "@slack/bolt";
import dotenv from "dotenv";
import { connectToDatabase, closeDatabaseConnection } from "./db/connection";
import { registerFeatures } from "./features";
import { PhaseTransitionService } from "./services/PhaseTransition";
import { LogLevel } from "@slack/logger";

// Load environment variables
dotenv.config();

// Global error handlers for uncaught exceptions and unhandled rejections
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // In production, we might want to perform cleanup before exiting
  closeDatabaseConnection().finally(() => {
    process.exit(1);
  });
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Note: We don't exit the process here since it could be recoverable
});

// Create a singleton instance of the phase transition service
// This is exported for backwards compatibility
export const phaseTransitionService = PhaseTransitionService.getInstance(
  null as any, // Will be initialized properly in initializeServices
  process.env.TEST_MODE === "true" ? 10 : 60 // 10 seconds for test mode, 60 minutes for production
);

/**
 * Creates and configures a Bolt app based on the environment
 */
export function createApp(options: { receiver?: ExpressReceiver } = {}) {
  // Check for required environment variables
  const requiredEnvVars = [
    {
      name: "SLACK_APP_BOT_TOKEN",
      description: "Bot User OAuth Token (starts with xoxb-)",
    },
    ...(process.env.USE_SOCKET_MODE === "true"
      ? [
          {
            name: "SLACK_APP_TOKEN",
            description: "App-Level Token (starts with xapp-)",
          },
        ]
      : []),
    {
      name: "SLACK_APP_SIGNING_SECRET",
      description: "Signing Secret from Basic Information",
    },
    {
      name: "MONGODB_URI",
      description: "MongoDB Connection URI",
    },
  ];

  const missingVars = requiredEnvVars.filter((v) => !process.env[v.name]);
  if (missingVars.length > 0) {
    console.error("Error: Missing required environment variables:");
    missingVars.forEach((v) => {
      console.error(`- ${v.name}: ${v.description}`);
    });
    console.error("Please add these to your .env file");
    process.exit(1);
  }

  // Determine if we should use Socket Mode based on environment variable
  const useSocketMode = process.env.USE_SOCKET_MODE === "true";

  // Initialize Slack app with appropriate settings based on mode
  const app = new App({
    token: process.env.SLACK_APP_BOT_TOKEN,
    signingSecret: process.env.SLACK_APP_SIGNING_SECRET,
    // Only use Socket Mode if explicitly enabled
    socketMode: useSocketMode,
    ...(useSocketMode ? { appToken: process.env.SLACK_APP_TOKEN } : {}),
    // For production, explicitly set additional security options
    logLevel:
      process.env.NODE_ENV === "production" ? LogLevel.ERROR : LogLevel.INFO,
    // Add custom request handling timeouts (ms)
    processBeforeResponse: true,
    // Use provided receiver if available
    ...options,
  });

  // Log all errors
  app.error(async (error) => {
    console.error("Slack app error:", error);
  });

  // Register all features (commands and actions)
  registerFeatures(app);

  return app;
}

/**
 * Initializes the database and phase transition service
 */
export async function initializeServices(app: App) {
  try {
    // Connect to database
    await connectToDatabase();

    // Initialize and start the Phase Transition Service with the proper app instance
    phaseTransitionService.setApp(app);
    phaseTransitionService.start();

    return { phaseTransitionService };
  } catch (error) {
    console.error("Error initializing services:", error);
    throw error;
  }
}

/**
 * Starts the Bolt app server
 */
export async function startServer(app: App) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const useSocketMode = process.env.USE_SOCKET_MODE === "true";

  try {
    if (useSocketMode) {
      console.log("⚡️ Starting Chapters in Socket Mode");
      await app.start();
    } else {
      console.log(`⚡️ Starting Chapters in HTTP mode on port ${port}`);
      await app.start(port);
    }

    console.log(
      `⚡️ Chapters is running ${
        useSocketMode ? "in Socket Mode" : `on port ${port}`
      }!`
    );

    // Log environment mode for visibility
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    if (process.env.TEST_MODE === "true") {
      console.log("⚠️ Running in TEST MODE - not suitable for production!");
    }
  } catch (error) {
    console.error("Error starting the server:", error);
    throw error;
  }
}

// Start the app if not being imported elsewhere
if (require.main === module) {
  (async () => {
    try {
      const app = createApp();
      await initializeServices(app);
      await startServer(app);
    } catch (error) {
      console.error("Error in main process:", error);
      await closeDatabaseConnection();
      process.exit(1);
    }
  })();
}
