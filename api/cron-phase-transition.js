// Serverless endpoint for Vercel CRON job to trigger phase transitions
const { PhaseTransitionService } = require("../dist/services/PhaseTransition");
const { connectToDatabase } = require("../dist/db");
const { WebClient } = require("@slack/web-api");

module.exports = async (req, res) => {
  // Verify this is coming from Vercel Cron
  const userAgent = req.headers["user-agent"];
  if (!userAgent || !userAgent.includes("vercel-cron")) {
    console.log("👮‍♂️ Request rejected: Not from Vercel Cron");
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("🔄 CRON job triggered: Running phase transition check");

  try {
    // Connect to database
    await connectToDatabase();
    console.log("✅ Database connection established");

    // Explicitly initialize the Slack WebClient
    if (!process.env.SLACK_BOT_TOKEN) {
      throw new Error("SLACK_BOT_TOKEN environment variable is not set");
    }
    const webClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    console.log("✅ Slack WebClient initialized successfully");

    // Get singleton instance of the service and explicitly pass the WebClient
    const phaseTransitionService = PhaseTransitionService.getInstance(null);
    phaseTransitionService.setWebClient(webClient);

    // Trigger a single check
    await phaseTransitionService.triggerCheck();

    console.log("✅ Phase transition check completed successfully");
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Error in phase transition check:", error);
    return res.status(500).json({
      error: "Failed to run phase transition check",
      message: error.message,
    });
  }
};
