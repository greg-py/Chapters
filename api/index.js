// Serverless entry point for Vercel deployment
const { createApp, initializeServices } = require("../dist/index");

// In-memory cache to avoid re-initializing on every request
let app;
let expressApp;

module.exports = async (req, res) => {
  // Initialize app if it's not already created
  if (!app) {
    try {
      console.log("Initializing Slack app in serverless environment");
      app = createApp();
      await initializeServices(app);

      // Get the Express app instance from the receiver
      expressApp = app.receiver.app;

      console.log(
        "Slack app initialized successfully in serverless environment"
      );
    } catch (error) {
      console.error("Failed to initialize app:", error);
      return res
        .status(500)
        .send("Internal Server Error: Failed to initialize app");
    }
  }

  // Forward the request to the Express app using .handle() method
  return expressApp.handle(req, res);
};
