// This is a handler for Vercel serverless functions
// It imports and starts the app, providing HTTP endpoints for Slack when not using Socket Mode
const { App, ExpressReceiver } = require("@slack/bolt");

// Initialize an ExpressReceiver
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_APP_SIGNING_SECRET,
  processBeforeResponse: true, // Required for Vercel/serverless
});

// Initialize the Bolt app with the receiver
const app = new App({
  token: process.env.SLACK_APP_BOT_TOKEN,
  receiver: receiver,
  // processBeforeResponse: true, // Already set in receiver options
});

// Load your app functionality (listeners, etc.)
// It's crucial that this happens *before* the express app is exported
try {
  require("../dist/index")(app); // Assuming your compiled listeners are here
  console.log("⚡️ Bolt app listeners registered!");
} catch (error) {
  console.error("Error loading app functionality:", error);
  // Optionally, throw the error or handle it gracefully
  // throw new Error("Failed to load app functionality");
}

// Use the receiver's express app instance
const expressApp = receiver.app;

// Basic home route (optional, but good for health checks)
expressApp.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Chapters Slack bot is running via ExpressReceiver on Vercel.",
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

// Export the express app for Vercel
module.exports = expressApp;
