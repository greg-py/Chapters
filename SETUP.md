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
     - `SLACK_APP_TOKEN` (only if using Socket Mode)
     - `SLACK_APP_SIGNING_SECRET`
     - `MONGODB_URI` (use a cloud MongoDB instance like MongoDB Atlas)
     - `NODE_ENV=production`
     - `USE_SOCKET_MODE=false` (to use HTTP mode instead of Socket Mode)

3. **Deploy the App**

   - Using Vercel CLI: Run `vercel` in the project root
   - Or use the Vercel dashboard and connect your GitHub repository

4. **Configure Slack App for HTTP Mode**

   When using HTTP mode (`USE_SOCKET_MODE=false`), you need to configure your Slack app with Request URLs:

   1. **Disable Socket Mode** in your Slack app configuration

   2. **Set the Request URLs** in your Slack app dashboard:

      - **Event Subscriptions**: Set URL to `https://your-app-name.vercel.app/slack/events`
      - **Interactivity & Shortcuts**: Set URL to `https://your-app-name.vercel.app/slack/interactions`
      - **Slash Commands**: For each command, set URL to `https://your-app-name.vercel.app/slack/commands`

   3. **Subscribe to Bot Events** under Event Subscriptions:
      - `app_mention`
      - Any other events your app needs to handle

5. **Verify Endpoints**

   - Slack will verify your endpoints when you save the configuration
   - If verification fails, check your Vercel logs for errors

6. **Test the Commands**
   - Use `/chapters-ping` in Slack to test if your bot is responding

## Socket Mode vs HTTP Mode

This application supports two modes of operation:

### Socket Mode (Recommended for Development)

- Uses a WebSocket connection to Slack
- Doesn't require public URLs
- Requires an App-Level Token (`SLACK_APP_TOKEN`)
- Set `USE_SOCKET_MODE=true` in your environment

### HTTP Mode (Recommended for Production)

- Uses HTTP endpoints that Slack sends requests to
- Requires public URLs for your endpoints
- More reliable for production use
- Set `USE_SOCKET_MODE=false` in your environment
- Configure Request URLs in your Slack app settings

## Vercel HTTP Mode Configuration

When using HTTP mode with Vercel, follow these steps:

1. In the Vercel dashboard, set the environment variable `USE_SOCKET_MODE=false`

2. In your Slack app settings (https://api.slack.com/apps):

   a. **Disable Socket Mode**:

   - Go to "Socket Mode" and turn it off

   b. **Configure Event Subscriptions**:

   - Enable Events
   - Set the Request URL to `https://your-app-name.vercel.app/slack/events`
   - Under "Subscribe to bot events", add `app_mention` and any other events you need
   - Save changes

   c. **Configure Interactivity & Shortcuts**:

   - Enable Interactivity
   - Set the Request URL to `https://your-app-name.vercel.app/slack/interactions`
   - Save changes

   d. **Configure Slash Commands**:

   - For each command (e.g., `/chapters-ping`), set the Request URL to `https://your-app-name.vercel.app/slack/commands`

3. Redeploy your app to Vercel if needed

4. Test by using `/chapters-ping` in a Slack channel where the app is installed

## Troubleshooting HTTP Mode

If your Slack app isn't responding in HTTP mode:

1. **Check URL Verification**

   - When you set the Request URL, Slack sends a challenge to verify ownership
   - The app should automatically respond to this challenge
   - Check Vercel logs for any errors during this verification

2. **Verify Environment Variables**
   - Ensure `USE_SOCKET_MODE` is set to `false`
   - Verify all other required environment variables are set
3. **Check Vercel Logs**

   - Look for any initialization errors
   - Check if the middleware is being created successfully

4. **Test Endpoints Manually**
   - Visit `https://your-app-name.vercel.app/` to see if the app is running
   - You should see a JSON response with status "ok"
5. **Verify Slack App Settings**
   - Ensure Socket Mode is disabled
   - Check that all request URLs are correctly set
   - Verify the app has all required scopes and permissions

If issues persist, try redeploying the app or check the Slack Developer documentation for more troubleshooting tips.
