// This is a handler for Vercel serverless functions
// It imports and starts the app, providing HTTP endpoints for Slack when not using Socket Mode
const { App } = require("@slack/bolt");
const express = require("express");

// Create Express app for handling requests
const expressApp = express();

// Initialize the Bolt app directly for HTTP mode
const app = new App({
  token: process.env.SLACK_APP_BOT_TOKEN,
  signingSecret: process.env.SLACK_APP_SIGNING_SECRET,
  processBeforeResponse: true, // Process requests before responding to Slack
});

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

// Forward all Slack POST requests to the Bolt app
expressApp.post("/slack/events", (req, res) => {
  // Handle Slack URL verification challenge
  if (req.body && req.body.type === "url_verification") {
    console.log("Handling Slack URL verification challenge");
    return res.status(200).json({ challenge: req.body.challenge });
  }

  // Forward to the Bolt app
  app.receiver.requestHandler(req, res);
});

expressApp.post("/slack/commands", (req, res) => {
  app.receiver.requestHandler(req, res);
});

expressApp.post("/slack/interactions", (req, res) => {
  app.receiver.requestHandler(req, res);
});

// Load your app functionality
// Note: In a typical Bolt app, you would register event listeners here
// For example: app.event('app_mention', mentionHandler);
// Import your actual app code here to register all event handlers
try {
  require("../dist/index")(app);
} catch (error) {
  console.error("Error loading app functionality:", error);
}

// Export the Express app for Vercel
module.exports = expressApp;
