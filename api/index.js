// Vercel serverless function handler for Slack API requests
require("dotenv").config();

const { App, ExpressReceiver } = require("@slack/bolt");

// Set environment variable for HTTP mode
process.env.USE_SOCKET_MODE = "false";

// Create an ExpressReceiver for handling HTTP requests
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_APP_SIGNING_SECRET,
  processBeforeResponse: true, // Required for Vercel/serverless
  // Explicitly set endpoints for different Slack interactions
  endpoints: {
    events: "/slack/events",
    commands: "/slack/commands",
    interactions: "/slack/interactions",
  },
});

// Initialize the app
const app = new App({
  token: process.env.SLACK_APP_BOT_TOKEN,
  receiver: receiver,
  processBeforeResponse: true, // Critical for serverless
});

// Get the Express app from the receiver
const expressApp = receiver.app;

// Register slash commands
app.command("/chapters-ping", async ({ ack, command, say }) => {
  try {
    await ack();
    await say("Pong! Chapters is up and running!");
  } catch (error) {
    console.error("Error handling /chapters-ping command:", error);
  }
});

// Hello command for testing
app.command("/hello", async ({ ack, command, say }) => {
  try {
    await ack();
    await say(`Hello <@${command.user_id}>! This is a test slash command.`);
  } catch (error) {
    console.error("Error handling /hello command:", error);
  }
});

// API health check route
expressApp.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Chapters Slack bot API is running",
    version: process.env.npm_package_version || "unknown",
  });
});

// Start local server if in development mode
if (process.env.NODE_ENV === "development") {
  const port = process.env.PORT || 3000;
  expressApp.listen(port, () => {
    console.log(`⚡️ Local development server running on port ${port}`);
    console.log(`💡 To expose to Slack, use: ngrok http ${port}`);
    console.log(`🔗 Then update Request URLs in your Slack App config to:`);
    console.log(`   - Events: https://your-ngrok-url/slack/events`);
    console.log(`   - Commands: https://your-ngrok-url/slack/commands`);
    console.log(`   - Interactions: https://your-ngrok-url/slack/interactions`);
  });
}

// Export the Express app for Vercel
module.exports = expressApp;
