// This is a handler for Vercel serverless functions
// It imports and starts the app, providing HTTP endpoints for Slack when not using Socket Mode
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const express = require("express");
const { createServer } = require("http");
const { createNodeMiddleware } = require("@slack/bolt");

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

// Home endpoint
expressApp.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message:
      "Chapters Slack bot is running in HTTP mode. Ready for Slack requests.",
  });
});

// Slack event endpoints
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
    return res.status(200).send();
  }
};

// Setup Slack API endpoints
expressApp.post("/slack/events", slackEventHandler);
expressApp.post("/slack/commands", slackEventHandler);
expressApp.post("/slack/interactions", slackEventHandler);

// Export the Express app for Vercel
module.exports = expressApp;
