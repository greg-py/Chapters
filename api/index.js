// This is a handler for Vercel serverless functions
// It imports and starts the app, providing HTTP endpoints for Slack when not using Socket Mode
const path = require("path");
const fs = require("fs");
const express = require("express");
const { createNodeMiddleware } = require("@slack/bolt");
const crypto = require("crypto");

// Create Express app for handling requests
const expressApp = express();

// For handling Slack HTTP requests
let slackApp;
let slackMiddleware;
let isInitialized = false;

// Initialize app
const initializeApp = async () => {
  if (isInitialized) return true;

  try {
    console.log("Starting Slack app in HTTP mode...");

    // Check if dist directory exists
    const distDir = path.join(__dirname, "../dist");
    if (
      !fs.existsSync(distDir) ||
      !fs.existsSync(path.join(distDir, "index.js"))
    ) {
      console.log("Dist directory not found");
      return false;
    }

    // Set environment variable to disable Socket Mode for the import
    process.env.USE_SOCKET_MODE = "false";

    // Import and initialize the app
    const mainApp = require("../dist/index");
    slackApp = mainApp.default || mainApp.app;

    // Create middleware for Slack requests
    if (slackApp && slackApp.receiver) {
      slackMiddleware = createNodeMiddleware(slackApp.receiver);
      isInitialized = true;
      console.log("Slack app initialized successfully");
      return true;
    } else {
      console.error(
        "Failed to initialize Slack app: App or receiver not found"
      );
      return false;
    }
  } catch (error) {
    console.error("Error initializing Slack app:", error);
    return false;
  }
};

// Parse JSON and URL-encoded requests
expressApp.use(express.json());
expressApp.use(express.urlencoded({ extended: true }));

// Verify Slack requests if needed
const verifySlackRequest = (req, res, next) => {
  // Skip verification in development or if no signing secret
  if (
    process.env.NODE_ENV !== "production" ||
    !process.env.SLACK_APP_SIGNING_SECRET
  ) {
    return next();
  }

  try {
    const slackSignature = req.headers["x-slack-signature"];
    const timestamp = req.headers["x-slack-request-timestamp"];

    if (!slackSignature || !timestamp) {
      console.log("Missing Slack signature or timestamp");
      return next();
    }

    // Skip outdated requests (helps prevent replay attacks)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      return res.status(400).send("Ignoring outdated request");
    }

    // Get raw body
    const rawBody =
      typeof req.body === "string"
        ? req.body
        : req.body && Object.keys(req.body).length === 0
        ? ""
        : JSON.stringify(req.body);

    // Compute signature based on timestamp and body
    const sigBasestring = "v0:" + timestamp + ":" + rawBody;
    const mySignature =
      "v0=" +
      crypto
        .createHmac("sha256", process.env.SLACK_APP_SIGNING_SECRET)
        .update(sigBasestring, "utf8")
        .digest("hex");

    // Compare signatures
    if (
      crypto.timingSafeEqual(
        Buffer.from(mySignature, "utf8"),
        Buffer.from(slackSignature, "utf8")
      )
    ) {
      return next();
    } else {
      console.error("Slack request verification failed");
      return res.status(400).send("Verification failed");
    }
  } catch (error) {
    console.error("Error verifying Slack request:", error);
    next(); // Allow to pass in case of error, but log it
  }
};

// Home endpoint
expressApp.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message:
      "Chapters Slack bot is running in HTTP mode. Ready for Slack requests.",
  });
});

// GET handlers for all Slack endpoints (for browser testing)
expressApp.get("/slack/events", (req, res) => {
  res.status(200).json({
    status: "ok",
    message:
      "This is the Slack events endpoint. Slack will send POST requests here, not GET requests.",
  });
});

expressApp.get("/slack/commands", (req, res) => {
  res.status(200).json({
    status: "ok",
    message:
      "This is the Slack commands endpoint. Slack will send POST requests here, not GET requests.",
  });
});

expressApp.get("/slack/interactions", (req, res) => {
  res.status(200).json({
    status: "ok",
    message:
      "This is the Slack interactions endpoint. Slack will send POST requests here, not GET requests.",
  });
});

// Special handler for Slack URL verification for events
expressApp.post("/slack/events", verifySlackRequest, (req, res, next) => {
  // Log the request for debugging
  console.log("Received /slack/events request:", {
    type: req.body?.type,
    hasChallenge: !!req.body?.challenge,
  });

  // Handle Slack URL verification challenge
  if (req.body && req.body.type === "url_verification") {
    console.log("Handling Slack URL verification challenge");
    return res.status(200).json({ challenge: req.body.challenge });
  }

  // Continue to regular event processing
  slackEventHandler(req, res, next);
});

// Special handler for Slack commands verification
expressApp.post("/slack/commands", verifySlackRequest, (req, res, next) => {
  // Log the request for debugging
  console.log("Received /slack/commands request:", {
    command: req.body?.command,
  });

  // For commands, we need to initialize the app first
  slackEventHandler(req, res, next);
});

// Special handler for Slack interactions verification
expressApp.post("/slack/interactions", verifySlackRequest, (req, res, next) => {
  // Log the request for debugging
  console.log("Received /slack/interactions request:", {
    type: req.body?.type,
  });

  // For interactions, we need to initialize the app first
  slackEventHandler(req, res, next);
});

// Slack event handler for all endpoints
const slackEventHandler = async (req, res, next) => {
  if (!isInitialized) {
    const success = await initializeApp();
    if (!success) {
      return res.status(500).json({
        status: "error",
        message: "Failed to initialize Slack app",
      });
    }
  }

  if (slackMiddleware) {
    // Use the Slack middleware to handle the request
    return slackMiddleware(req, res, next);
  } else {
    // Fallback if middleware isn't available
    console.log("No middleware available, sending basic acknowledgment");
    return res.status(200).send();
  }
};

// Export the Express app for Vercel
module.exports = expressApp;
