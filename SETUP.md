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
2. Run in development: `npm run dev`
3. For production: `npm run build` then `npm start`

## Deploying to Production

For a production environment:

1. Set up a server or cloud service (AWS, Heroku, etc.)
2. Configure environment variables on your hosting platform
3. Make sure your MongoDB instance is accessible from your hosting environment
4. Set up your Slack app's Request URL to point to your deployed instance
5. Deploy your application using `npm run build` and `npm start`
