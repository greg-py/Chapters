// This is a simple API handler for Vercel serverless functions
// It imports and starts our main app

// For Vercel deployment - the actual app is started via Socket Mode
module.exports = (req, res) => {
  try {
    // This only runs once when the serverless function is first initialized
    if (!global.appStarted) {
      // We import and start the app here
      global.appStarted = true;
      console.log(
        "Starting Slack app in Socket Mode via Vercel serverless function"
      );

      // Load the main app
      require("../dist/index.js");
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
