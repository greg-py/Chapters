# Slack Bot Setup Guide

## Development Environment

### Prerequisites

1. Docker and Docker Compose installed
2. Node.js 20 or later
3. A Slack workspace for development
4. A Slack app configured for development

### Required Environment Variables

Create a `.env` file in the root of the project with these required variables:

```
# Required Slack API credentials
SLACK_APP_BOT_TOKEN=xoxb-your-dev-bot-token
SLACK_APP_TOKEN=xapp-your-dev-app-token
SLACK_APP_SIGNING_SECRET=your-dev-signing-secret

# MongoDB Configuration (for local development)
MONGODB_URI=mongodb://mongodb:27017/chapters

# Application Configuration
NODE_ENV=development
USE_SOCKET_MODE=true
```

### How to Get the Tokens

1. **SLACK_APP_SIGNING_SECRET**

   - Found in the "Basic Information" section of your Slack app
   - This is your app's signing secret for request verification

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

### Slack App Configuration

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

### Running the Bot

Once configured:

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development environment:

   ```bash
   npm run dev
   ```

   This will:

   - Start MongoDB in a Docker container
   - Start the application in development mode
   - Enable hot reloading
   - Use Socket Mode for Slack communication

3. For phase testing (accelerated transitions):

   ```bash
   npm run dev:phasetest
   ```

   This will:

   - Start a separate MongoDB instance for testing
   - Enable 1-minute phase durations
   - Run phase transition checks every 10 seconds
   - Keep test data isolated from development data

## Production Environment

### Prerequisites

1. A Vercel account
2. The Vercel CLI (optional for direct deployments)
3. A MongoDB Atlas database
4. A production Slack workspace
5. A production Slack app

### Environment Setup

1. **MongoDB Atlas Setup**:

   - Create a MongoDB Atlas account
   - Create a new cluster
   - Set up database access (user/password)
   - Set up network access (IP whitelist)
   - Get your connection string

2. **Production Slack App**:
   - Create a new Slack app for production
   - Configure the same scopes and commands as development
   - Install to your production workspace
   - Get the production tokens

### Vercel Deployment

1. **Install and login to Vercel CLI** (optional):

   ```bash
   npm install -g vercel
   vercel login
   ```

2. **Configure Environment Variables** in Vercel:

   - `SLACK_APP_BOT_TOKEN`: Your production bot token
   - `SLACK_APP_SIGNING_SECRET`: Your production signing secret
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `NODE_ENV`: `production`
   - `USE_SOCKET_MODE`: `false`

3. **Deploy to Vercel**:

   ```bash
   vercel --prod
   ```

4. **Configure Slack App for HTTP Mode**:
   1. Disable Socket Mode in your Slack app configuration
   2. Set the Request URLs in your Slack app dashboard:
      - **Event Subscriptions**: `https://your-app-name.vercel.app/slack/events`
      - **Interactivity & Shortcuts**: `https://your-app-name.vercel.app/slack/interactions`
      - **Slash Commands**: `https://your-app-name.vercel.app/slack/commands`
   3. Subscribe to Bot Events under Event Subscriptions:
      - `app_mention`
      - Any other events your app needs to handle

### Production vs Development Differences

1. **Environment**:

   - Development: Local Docker environment with hot reloading
   - Production: Vercel serverless functions

2. **Database**:

   - Development: Local MongoDB in Docker
   - Production: MongoDB Atlas

3. **Slack Communication**:

   - Development: Socket Mode (no public URL needed)
   - Production: HTTP Mode (requires public URL)

4. **Performance**:

   - Development: Optimized for development experience
   - Production: Optimized for performance and reliability

5. **Testing**:
   - Development: Includes phase testing mode
   - Production: No testing modes available

## Troubleshooting

### Development Environment

1. **MongoDB Connection Issues**:

   - Ensure Docker is running
   - Check if MongoDB container is running: `docker ps`
   - Verify MongoDB URI in `.env`

2. **Slack App Issues**:
   - Verify all tokens are correct
   - Check Socket Mode is enabled for development
   - Ensure app is installed to workspace

### Production Environment

1. **Vercel Deployment Issues**:

   - Check Vercel logs for errors
   - Verify all environment variables are set
   - Ensure MongoDB Atlas connection is working

2. **Slack Integration Issues**:
   - Verify Request URLs are correct
   - Check if Socket Mode is disabled
   - Ensure all required scopes are enabled
