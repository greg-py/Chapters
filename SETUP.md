# Slack Bot Setup Guide

## Required Environment Variables

Create a `.env` file in the root of the project with these required variables:

```
# Required Slack API credentials
SLACK_APP_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_APP_TOKEN=xapp-your-app-level-token-here
SLACK_APP_SIGNING_SECRET=your-signing-secret-here

# MongoDB connection
MONGODB_URI=mongodb://localhost:27017/chapters

# App settings
PORT=3000

# Testing settings
# Set to 'true' to use 1-minute phase durations for testing and 10-second checks
# TEST_MODE=true
```

## How to Get the Tokens

1. **SLACK_APP_SIGNING_SECRET**

   - This corresponds to `SLACK_APP_SIGNING_SECRET` in your current variables
   - Found in the "Basic Information" section of your Slack app

2. **SLACK_APP_BOT_TOKEN**

   - This is the Bot User OAuth Token (starts with `xoxb-`)
   - Go to your Slack app dashboard → "OAuth & Permissions"
   - If you haven't installed the app to your workspace yet, do so now
   - Copy the "Bot User OAuth Token"

3. **SLACK_APP_TOKEN**
   - This is an App-Level Token (starts with `xapp-`)
   - Go to "Basic Information" → scroll to "App-Level Tokens"
   - Create a new token with the `connections:write` scope
   - Copy the generated token

## Slack App Configuration

Ensure your Slack app has the following:

1. **Bot Token Scopes** (in OAuth & Permissions):

   - `chat:write` - Send messages as the app
   - `chat:write.public` - Send messages to channels the app isn't in
   - `commands` - Add slash commands
   - `app_mentions:read` - See when the bot is mentioned

2. **Event Subscriptions**:

   - Subscribe to `app_mention` events

3. **Slash Commands**:
   Create the following commands in the Slack app dashboard:
   - `/chapters-ping` - Check if the bot is running
   - `/chapters-help` - Show list of available commands
   - `/chapters-start-cycle` - Start a new book club cycle
   - `/chapters-cycle-status` - Check current cycle information
   - `/chapters-set-phase` - Manually change book club phase
   - `/chapters-suggest-book` - Open UI to suggest a book
   - `/chapters-view-suggestions` - View all book suggestions
   - `/chapters-vote` - Vote for your favorite books
   - `/chapters-voting-results` - View current voting results
   - `/chapters-complete-cycle` - Complete and archive the current cycle

## MongoDB Setup

1. Install MongoDB locally or use a cloud provider like MongoDB Atlas
2. Create a database named "chapters"
3. Update the MONGODB_URI in your .env file with the correct connection string

## Running the Bot

Once configured:

1. Install dependencies: `npm install`
2. Start MongoDB locally: `npm run db:start` (requires Docker)
3. Run in development: `npm run dev`
4. For production: `npm run build` then `npm start`

## Testing Phase Transitions

The app includes a test mode for rapid phase transitions:

1. Set `TEST_MODE=true` in your `.env` file
2. When enabled:
   - All phase durations are set to 1 minute (instead of days)
   - Phase transition checks run every 10 seconds (instead of hourly)
   - Console will display: `🧪 TEST MODE: Phase transition checks running every 10 seconds`
3. This allows you to test the full lifecycle of a book club cycle in minutes

## Phase Transition Messages

When the app transitions between phases, it sends informative messages with phase-specific context:

- **Voting Phase**: Displays a list of all suggested books available for voting
- **Reading Phase**: Shows the selected book with details including title, author, and link
- **Discussion Phase**: Includes congratulatory messages and discussion prompts

## Deploying to Production

For a production environment:

1. Set up a server or cloud service (AWS, Heroku, etc.)
2. Configure environment variables on your hosting platform
3. Make sure your MongoDB instance is accessible from your hosting environment
4. Set up your Slack app's Request URL to point to your deployed instance
5. Deploy your application using `npm run build` and `npm start`

## Deploying to Vercel

If you're using Vercel, follow these steps:

1. **Install and login to Vercel CLI** (optional)

   ```
   npm install -g vercel
   vercel login
   ```

2. **Configure Environment Variables**

   - Add all required environment variables in the Vercel dashboard (Project Settings > Environment Variables)
   - Add the following variables:
     - `SLACK_APP_BOT_TOKEN`
     - `SLACK_APP_TOKEN`
     - `SLACK_APP_SIGNING_SECRET`
     - `MONGODB_URI` (use a cloud MongoDB instance like MongoDB Atlas)
     - `NODE_ENV=production`

3. **Deploy the App**

   - Using Vercel CLI: Run `vercel` in the project root
   - Or use the Vercel dashboard and connect your GitHub repository

4. **Enable Socket Mode for Slack**

   - Ensure your Slack app has Socket Mode enabled in the Slack App configuration page
   - With Socket Mode, you don't need to specify a Request URL in your Slack app configuration
   - Make sure your SLACK_APP_TOKEN has the `connections:write` scope

5. **Verify the Deployment**

   - Open your Vercel deployment URL (e.g., https://your-app-name.vercel.app/) to verify the app has deployed
   - You should see a JSON response indicating the app is running
   - Use `/chapters-ping` in Slack to test if your bot is responding

6. **Troubleshooting**
   - If the bot doesn't respond to commands, check the Vercel logs for errors
   - Verify that all environment variables are set correctly
   - Make sure your MongoDB instance is accessible from Vercel's servers
   - Check that your Slack app has all required scopes and permissions

Remember that Vercel functions run serverless, so there's no persistent server to maintain. The app will initialize when the API endpoint is first accessed, establishing the Socket Mode connection with Slack.
