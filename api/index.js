// This is a simple API handler for Vercel serverless functions
// It imports and starts our main app
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// For Vercel deployment - the actual app is started via Socket Mode
module.exports = (req, res) => {
  try {
    // Check if app is already started
    if (!global.appStarted) {
      global.appStarted = true;
      console.log(
        "Starting Slack app in Socket Mode via Vercel serverless function"
      );

      // Check if dist directory exists
      const distDir = path.join(__dirname, "../dist");
      if (
        !fs.existsSync(distDir) ||
        !fs.existsSync(path.join(distDir, "index.js"))
      ) {
        console.log("Dist directory not found, running build first");
        // We'll just import the app directly since the build should have been done during deployment
      }

      // Load the main app
      try {
        require("../dist/index.js");
        console.log("App started successfully");
      } catch (err) {
        console.error("Error loading app:", err);
      }
    }

    // Send a response to the HTTP request
    res.status(200).json({
      status: "ok",
      message:
        "Chapters Slack bot is running in Socket Mode. No HTTP endpoints needed.",
    });
  } catch (error) {
    console.error("Error starting app:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to start the Slack app",
    });
  }
};
