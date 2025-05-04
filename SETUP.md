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
   - `commands` - Add slash commands
   - `app_mentions:read` - See when the bot is mentioned

2. **Event Subscriptions**:

   - Subscribe to `app_mention` and `message.channels` events

3. **Slash Commands**:
   - Create commands in the Slack app dashboard that match what's in your code:
     - `/chapters-help`
     - `/chapters-suggest`
     - `/chapters-list`
     - `/chapters-vote`
     - `/chapters-status`

## Running the Bot

Once configured:

1. Install dependencies: `npm install`
2. Run in development: `npm run dev`
3. For production: `npm run build` then `npm start`
