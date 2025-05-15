/**
 * Server utilities
 * Handles HTTP/Express server configuration and setup
 */
import { ExpressReceiver } from "@slack/bolt";
import { Request, Response } from "express";
import { SlackEndpoints, Security, API } from "../constants";
import { getAppVersion } from "./version";

/**
 * Type definition for Express app
 */
export type ExpressApp = {
  get: (path: string, handler: (req: Request, res: Response) => void) => void;
  use: (middleware: any) => void;
  (req: Request, res: Response): void;
};

/**
 * Creates an Express receiver for Slack webhooks
 *
 * @param signingSecret - The Slack signing secret for request validation
 * @returns Configured ExpressReceiver
 */
export function createExpressReceiver(signingSecret: string): ExpressReceiver {
  const receiver = new ExpressReceiver({
    signingSecret,
    processBeforeResponse: true, // Required for Vercel/serverless
    // Explicitly set endpoints for different Slack interactions
    endpoints: {
      events: SlackEndpoints.EVENTS,
      commands: SlackEndpoints.COMMANDS,
      interactions: SlackEndpoints.INTERACTIONS,
    },
    // Handle request timeouts
    dispatchErrorHandler: async ({ error, logger, response }) => {
      logger.error("Receiver dispatch error:", error);
      // Return a 200 status to prevent Slack from retrying
      // For critical errors where retries are desired, change to 500
      response.writeHead(200);
      response.end(
        JSON.stringify({
          error: "Processing error",
          ok: false,
        })
      );
    },
  });

  // Get the Express app from the receiver
  const expressApp = receiver.app as unknown as ExpressApp;

  // Configure the Express app
  configureExpressApp(expressApp);

  return receiver;
}

/**
 * Configures an Express app with security middleware and routes
 *
 * @param app - The Express app to configure
 */
export function configureExpressApp(app: ExpressApp): void {
  // Add security headers middleware
  app.use((req: Request, res: Response, next: Function) => {
    // Set security headers
    res.setHeader(
      Security.HEADERS.CONTENT_TYPE_OPTIONS,
      Security.HEADER_VALUES.NO_SNIFF
    );
    res.setHeader(
      Security.HEADERS.FRAME_OPTIONS,
      Security.HEADER_VALUES.DENY_FRAMES
    );
    res.setHeader(
      Security.HEADERS.XSS_PROTECTION,
      Security.HEADER_VALUES.BLOCK_XSS
    );
    next();
  });

  // API health check route
  app.get(API.HEALTH_CHECK_PATH, (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      message: "Chapters Slack bot API is running",
      version: getAppVersion(),
      environment: process.env.NODE_ENV || "development",
    });
  });
}
