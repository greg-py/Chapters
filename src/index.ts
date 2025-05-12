import { App } from "@slack/bolt";
import dotenv from "dotenv";
import { connectToDatabase, closeDatabaseConnection } from "./db/connection";
import { registerFeatures } from "./features";
import { PhaseTransitionService } from "./services/PhaseTransition";
import { LogLevel } from "@slack/logger";

// Load environment variables
dotenv.config();

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
});

// Log all errors
app.error(async (error) => {
  console.error("Slack app error:", error);
});

// Register all features (commands and actions)
registerFeatures(app);

// Initialize and start the Phase Transition Service
// We use the getInstance method to ensure only one instance exists across the app
export const phaseTransitionService = PhaseTransitionService.getInstance(
  app,
  process.env.TEST_MODE === "true" ? 10 : 60 // 10 seconds for test mode, 60 minutes for production
);

// Add global error handlers for uncaught exceptions and unhandled rejections
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

// Start the app if not being imported elsewhere
if (require.main === module) {
  // Start the app
  (async () => {
    try {
      // Connect to database
      await connectToDatabase();

      // Start the phase transition service
      phaseTransitionService.start();

      const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
      console.error("Error starting the app:", error);
      await closeDatabaseConnection();
      process.exit(1);
    }
  })();
}

// Export the app for use in other modules
export { app };
