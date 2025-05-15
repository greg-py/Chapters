/**
 * Chapters Slack Bot Application Entry Point
 *
 * This file serves as the main entry point for both development and production environments.
 * It handles initialization, configuration, and startup for both local development servers
 * and serverless deployments (Vercel).
 */

import { App, LogLevel } from "@slack/bolt";
import dotenv from "dotenv";
import { connectToDatabase } from "./db/connection";
import { registerFeatures } from "./features";
import { PhaseTransitionService } from "./services/PhaseTransition";
import { Request, Response } from "express";
import http from "http";
import { validateEnvironment } from "./validators/environment";
import {
  registerTerminationHandlers,
  performGracefulShutdown,
} from "./utils/shutdown";
import { createExpressReceiver, type ExpressApp } from "./utils/server";
import { API, SlackErrorCode } from "./constants";

// Load environment variables early in the process
dotenv.config();

// Create a singleton instance of the phase transition service
// This is exported for backwards compatibility
export const phaseTransitionService = PhaseTransitionService.getInstance(
  null as any, // Will be initialized properly in initializeServices
  process.env.PHASE_TEST_MODE === "true" ? 10 : 60 // 10 seconds for test mode, 60 minutes for production
);

// Track initialized state
let appInstance: App | null = null;
let expressApp: ExpressApp | null = null;
let server: http.Server | null = null;

/**
 * Creates and configures a Bolt app based on the environment
 *
 * @param options - Optional configuration for the Bolt app
 * @returns Configured Bolt app instance
 */
export function createApp(
  options: { receiver?: ReturnType<typeof createExpressReceiver> } = {}
): App {
  // If app already exists, return it
  if (appInstance) return appInstance;

  try {
    // Validate environment variables before proceeding
    validateEnvironment();

    // Determine if we should use Socket Mode based on environment variable
    const useSocketMode = process.env.USE_SOCKET_MODE === "true";
    const isProduction = process.env.NODE_ENV === "production";

    let receiver = options.receiver;

    // If not using Socket Mode and no receiver provided, create an ExpressReceiver
    if (!useSocketMode && !receiver) {
      receiver = createExpressReceiver(
        process.env.SLACK_APP_SIGNING_SECRET || ""
      );

      // Store express app for later use in serverless function
      expressApp = receiver.app as unknown as ExpressApp;
    }

    // Initialize Slack app with appropriate settings based on mode
    const app = new App({
      token: process.env.SLACK_APP_BOT_TOKEN,
      signingSecret: process.env.SLACK_APP_SIGNING_SECRET,
      // Only use Socket Mode if explicitly enabled
      socketMode: useSocketMode,
      ...(useSocketMode ? { appToken: process.env.SLACK_APP_TOKEN } : {}),
      // Configure logging based on environment
      logLevel: isProduction ? LogLevel.ERROR : LogLevel.INFO,
      // For production, use more conservative timeouts
      customRoutes: [], // Using empty customRoutes instead of clientOptions to avoid type issues
      // Add custom request handling timeouts (ms)
      processBeforeResponse: true,
      // Use our created receiver if available
      ...(receiver ? { receiver } : {}),
      // Include any other options
      ...options,
    });

    // Log all errors
    app.error(async (error) => {
      console.error("[SLACK_APP_ERROR]", error);
    });

    // Handle rate limiting
    app.use(async ({ next, body }) => {
      try {
        await next();
      } catch (error: any) {
        if (error.code === SlackErrorCode.RATE_LIMITED) {
          console.warn(`Rate limit hit: ${error.message}`);
        }
        throw error;
      }
    });

    // Register all features (commands and actions)
    registerFeatures(app);

    // Store the app instance
    appInstance = app;

    return app;
  } catch (error) {
    console.error("Failed to create app:", error);
    throw error;
  }
}

/**
 * Initializes the database and phase transition service
 *
 * @param app - The Bolt app instance
 * @returns Object containing initialized services
 */
export async function initializeServices(app: App) {
  try {
    console.log("Initializing services...");

    // Connect to database
    await connectToDatabase();
    console.log("✅ Database connection established");

    // Initialize and start the Phase Transition Service with the proper app instance
    phaseTransitionService.setApp(app);
    phaseTransitionService.start();
    console.log("✅ Phase transition service started");

    console.log("✅ All services initialized successfully");

    return { phaseTransitionService };
  } catch (error) {
    console.error("❌ Error initializing services:", error);
    throw error;
  }
}

/**
 * Starts the Bolt app server (for local development)
 *
 * @param app - The Bolt app instance
 * @returns Promise that resolves when the server is started
 */
export async function startServer(app: App): Promise<void> {
  const port = process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : API.DEFAULT_PORT;
  const useSocketMode = process.env.USE_SOCKET_MODE === "true";

  try {
    if (useSocketMode) {
      console.log("⚡️ Starting Chapters in Socket Mode");
      await app.start();
    } else {
      console.log(`⚡️ Starting Chapters in HTTP mode on port ${port}`);
      // Store the server instance for graceful shutdown
      server = await app.start(port);
    }

    console.log(
      `⚡️ Chapters is running ${
        useSocketMode ? "in Socket Mode" : `on port ${port}`
      }!`
    );

    if (!useSocketMode) {
      console.log(`💡 To expose to Slack, use: ngrok http ${port}`);
      console.log(`🔗 Then update Request URLs in your Slack App config to:`);
      console.log(`   - Events: https://your-ngrok-url/slack/events`);
      console.log(`   - Commands: https://your-ngrok-url/slack/commands`);
      console.log(
        `   - Interactions: https://your-ngrok-url/slack/interactions`
      );
    }

    // Log environment mode for visibility
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    if (process.env.PHASE_TEST_MODE === "true") {
      console.log("⚠️ Running in TEST MODE - not suitable for production!");
    }

    // Register handlers for graceful shutdown
    registerTerminationHandlers({
      phaseTransitionService,
      server,
    });
  } catch (error) {
    console.error("Error starting the server:", error);
    throw error;
  }
}

/**
 * Initializes the app and services
 * Used by both local development and serverless
 *
 * @returns Object containing the initialized app and express app
 */
async function initialize() {
  if (!appInstance) {
    try {
      console.log(
        `Initializing Chapters (${process.env.NODE_ENV || "development"} mode)`
      );

      // For serverless (Vercel), always use HTTP mode
      if (process.env.NODE_ENV === "production") {
        process.env.USE_SOCKET_MODE = "false";
      }

      // Create and initialize the app
      const app = createApp();
      await initializeServices(app);

      return { app, expressApp };
    } catch (error) {
      console.error("❌ Error initializing Chapters:", error);
      // In serverless, don't exit the process
      if (process.env.NODE_ENV !== "production") {
        await performGracefulShutdown(1, "Initialization error", {
          phaseTransitionService,
        });
      }
      return { app: null, expressApp: null };
    }
  }

  return { app: appInstance, expressApp };
}

// Start the app if run directly (local development)
if (require.main === module) {
  (async () => {
    try {
      // Initialize app and services
      const { app } = await initialize();
      if (app) {
        // Start local development server
        await startServer(app);
      }
    } catch (error) {
      console.error("Error in main process:", error);
      await performGracefulShutdown(1, "Startup error", {
        phaseTransitionService,
      });
    }
  })();
}

/**
 * Serverless handler for Vercel
 *
 * @param req - HTTP request object
 * @param res - HTTP response object
 * @returns Express handler result
 */
export default async (req: Request, res: Response) => {
  try {
    const { expressApp } = await initialize();
    if (expressApp) {
      return expressApp(req, res);
    } else {
      console.error("Failed to initialize Express app for serverless handler");
      return res.status(500).json({
        error: "Failed to initialize application",
        status: "error",
      });
    }
  } catch (error) {
    console.error("Serverless handler error:", error);
    return res.status(500).json({
      error: "Internal server error",
      status: "error",
    });
  }
};
