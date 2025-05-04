import { App } from "@slack/bolt";
import dotenv from "dotenv";
import { connectToDatabase } from "./db/connection";
import { registerCommands } from "./commands";
import { registerActions } from "./actions";

// Load environment variables
dotenv.config();

// Check for required environment variables
const requiredEnvVars = [
  {
    name: "SLACK_APP_BOT_TOKEN",
    description: "Bot User OAuth Token (starts with xoxb-)",
  },
  {
    name: "SLACK_APP_TOKEN",
    description: "App-Level Token (starts with xapp-)",
  },
  {
    name: "SLACK_APP_SIGNING_SECRET",
    description: "Signing Secret from Basic Information",
  },
];

const missingVars = requiredEnvVars.filter((v) => !process.env[v.name]);
if (missingVars.length > 0) {
  console.error("Error: Missing required environment variables:");
  missingVars.forEach((v) => {
    console.error(`- ${v.name}: ${v.description}`);
  });
  console.error("Please add these to your .env file");
  process.exit(1);
}

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_APP_BOT_TOKEN,
  signingSecret: process.env.SLACK_APP_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// Log all errors
app.error(async (error) => {
  console.error("Slack app error:", error);
});

// Register all commands
registerCommands(app);

// Register all actions
registerActions(app);

// Start the app
(async () => {
  try {
    // Connect to database
    await connectToDatabase();

    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    await app.start(port);
    console.log(`⚡️ Chapters is running on port ${port}!`);
  } catch (error) {
    console.error("Error starting the app:", error);
    process.exit(1);
  }
})();
