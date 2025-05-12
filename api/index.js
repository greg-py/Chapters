// Vercel serverless function handler for Slack API requests
require("dotenv").config();

// Import app from compiled TypeScript code
const { createApp, initializeServices } = require("../dist/index");

let appInstance;
let expressApp;

// Initialize the app with a receiver for HTTP requests
async function initialize() {
  if (!appInstance) {
    try {
      // Set HTTP mode for production/serverless
      process.env.USE_SOCKET_MODE = "false";

      // Create the Bolt app (this will register all command handlers)
      appInstance = createApp();

      // Initialize services (database connection, etc.)
      await initializeServices(appInstance);

      // Extract the Express app from the Bolt app's receiver
      expressApp = appInstance.receiver.app;

      // API health check route
      expressApp.get("/", (req, res) => {
        res.status(200).json({
          status: "ok",
          message: "Chapters Slack bot API is running",
          version: process.env.npm_package_version || "unknown",
        });
      });

      console.log("✅ Chapters API initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing Chapters API:", error);
      // In serverless environments, we don't want to exit the process
      // Just let the request fail and retry on next invocation
    }
  }

  return expressApp;
}

// Start local server if in development mode
if (process.env.NODE_ENV === "development") {
  (async () => {
    const app = await initialize();
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`⚡️ Local development server running on port ${port}`);
      console.log(`💡 To expose to Slack, use: ngrok http ${port}`);
      console.log(`🔗 Then update Request URLs in your Slack App config to:`);
      console.log(`   - Events: https://your-ngrok-url/slack/events`);
      console.log(`   - Commands: https://your-ngrok-url/slack/commands`);
      console.log(
        `   - Interactions: https://your-ngrok-url/slack/interactions`
      );
    });
  })();
}

// Export a function that initializes and returns the Express app for Vercel
module.exports = async (req, res) => {
  const app = await initialize();
  return app(req, res);
};
