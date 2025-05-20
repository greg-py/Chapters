# Chapters: Book Club Management Bot for Slack

Chapters is a comprehensive Slack bot designed to streamline book club management. It automates the entire book club lifecycle, from collecting book suggestions to facilitating discussions.

## Features

- **Book Club Cycles**: Manage complete book club cycles from start to finish with archiving and statistics
- **Configurable Phases**: Customize the duration of each book club phase (suggestion, voting, reading, discussion)
- **Book Suggestions**: Members can suggest books with details like author, URL, and notes
- **Ranked Choice Voting**: Vote for preferred books using a ranked choice system
- **Book Club Status**: Check the current status and phase of the book club
- **Cycle History**: View past book club cycles with statistics and winning books
- **Anonymous Suggestions**: Book suggestions are displayed anonymously to prevent bias in voting
- **Automated Phase Transitions**: Phases transition automatically with informative messages at each stage
- **Phase-Specific Messages**: Each phase includes helpful context like available books during voting, the selected book during reading, and discussion prompts

## Development Setup

### Prerequisites

1. Docker and Docker Compose installed
2. Node.js 20 or later
3. A Slack workspace for development
4. A Slack app configured for development

### Environment Setup

1. Create a `.env` file in the root directory:

   ```
   # Slack App Credentials
   SLACK_APP_BOT_TOKEN=xoxb-your-dev-bot-token
   SLACK_APP_SIGNING_SECRET=your-dev-signing-secret

   # Socket Mode configuration (required only for development)
   USE_SOCKET_MODE=true
   SLACK_APP_TOKEN=xapp-your-dev-app-token  # Required only when USE_SOCKET_MODE=true

   # MongoDB Configuration (for local development)
   MONGODB_URI=mongodb://mongodb:27017/chapters

   # Application Configuration
   NODE_ENV=development
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

#### Normal Development

```bash
npm run dev
```

This will:

- Start MongoDB in a Docker container
- Start the application in development mode with hot reloading
- Use Socket Mode for Slack communication (if enabled)
- Mount your local code for live updates

#### Phase Testing Mode

```bash
npm run dev:phasetest
```

This will:

- Start a separate MongoDB instance for testing
- Enable accelerated phase transitions (1-minute phases)
- Run phase transition checks every 10 seconds
- Keep test data isolated from development data

#### Other Development Commands

- `npm run dev:build` - Rebuild and start the development environment
- `npm run dev:down` - Stop the development environment
- `npm run dev:phasetest` - Start the phase testing environment
- `npm run dev:phasetest:build` - Rebuild and start the phase testing environment

#### Testing Commands

- `npm run test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

#### Release Commands

- `npm run release` - Create a new release
- `npm run release:alpha` - Create an alpha pre-release
- `npm run release:beta` - Create a beta pre-release
- `npm run release:rc` - Create a release candidate

#### Database Commands

- `npm run migrate` - Run database migrations
- `npm run migrate:rollback` - Rollback the last migration

### Development vs Production

The application has two distinct environments that share the same codebase:

#### Development Environment

- Uses Docker Compose for local development
- Can run in Socket Mode (no public URL needed) or HTTP mode
- Uses local MongoDB instance
- Supports hot reloading
- Includes phase testing mode for rapid testing

#### Production Environment

- Deployed to Vercel as serverless functions
- Uses HTTP Mode (requires public URL)
- Uses MongoDB Atlas or similar cloud database
- Runs in production mode with optimized settings
- Utilizes Vercel CRON for automated phase transitions

## Automatic Phase Transitions

The application includes an automatic phase transition system that moves book clubs through different phases based on configured durations.

### Phase Transition Architecture

- **Development Environment**: Uses continuous interval checking via `setInterval`
- **Production Environment**: Uses Vercel CRON jobs that run hourly to check and perform phase transitions

The PhaseTransitionService has been designed to work in both environments:

- In local development, it uses a timer-based approach with configurable intervals
- In production (Vercel), it uses a serverless-compatible approach triggered by CRON jobs

### Vercel CRON Configuration

In production, phase transitions are handled by a Vercel CRON job that:

- Runs hourly via the `/api/cron-phase-transition` endpoint
- Checks all active cycles for phase transition eligibility
- Performs transitions and sends notifications automatically
- Requires no long-running processes or timers

This serverless approach ensures reliable phase transitions even in environments that don't support background processes.

## Command Reference

Here's a complete list of all available commands:

| Command                      | Short Description                      | Usage Hint                   |
| ---------------------------- | -------------------------------------- | ---------------------------- |
| `/chapters-ping`             | Check if the bot is running            | `/chapters-ping`             |
| `/chapters-help`             | Show list of available commands        | `/chapters-help`             |
| `/chapters-start-cycle`      | Start a new book club cycle            | `/chapters-start-cycle`      |
| `/chapters-cycle-status`     | Check current cycle information        | `/chapters-cycle-status`     |
| `/chapters-set-phase`        | Manually change book club phase        | `/chapters-set-phase`        |
| `/chapters-suggest-book`     | Open UI to suggest a book              | `/chapters-suggest-book`     |
| `/chapters-view-suggestions` | View all book suggestions              | `/chapters-view-suggestions` |
| `/chapters-vote`             | Vote for your favorite books           | `/chapters-vote`             |
| `/chapters-voting-results`   | View current voting results            | `/chapters-voting-results`   |
| `/chapters-complete-cycle`   | Complete and archive the current cycle | `/chapters-complete-cycle`   |
| `/chapters-version`          | Show current bot version               | `/chapters-version`          |
| `/chapters-reset-cycle`      | Reset and delete the current cycle     | `/chapters-reset-cycle`      |

## Detailed Command Descriptions

### `/chapters-ping`

**Short Description:** Check if the bot is running  
**Usage Hint:** `/chapters-ping`  
Verifies that the Chapters bot is operational and responding with "Pong! Chapters is up and running!".

### `/chapters-help`

**Short Description:** Show list of available commands  
**Usage Hint:** `/chapters-help`  
Displays a comprehensive list of all commands available in the Chapters bot.

### `/chapters-start-cycle`

**Short Description:** Start a new book club cycle  
**Usage Hint:** `/chapters-start-cycle`  
Initiates a new book club cycle with configurable phase durations. Opens a UI where you can set the cycle name and customize the duration of each phase (suggestion, voting, reading, discussion). Once configured and saved, it starts the suggestion phase where members can submit book ideas.

### `/chapters-cycle-status`

**Short Description:** Check current cycle information  
**Usage Hint:** `/chapters-cycle-status`  
Shows the current status of the active book club cycle, including cycle name, current phase, phase deadline, total book suggestions, and votes cast.

### `/chapters-set-phase`

**Short Description:** Manually change book club phase  
**Usage Hint:** `/chapters-set-phase`  
Opens a UI where you can select which phase to transition to (suggestion, voting, reading, or discussion). After confirmation, the cycle will be updated to the new phase and an announcement will be posted to the channel.

### `/chapters-suggest-book`

**Short Description:** Open UI to suggest a book  
**Usage Hint:** `/chapters-suggest-book`  
Opens a form UI where members can suggest a book for the current cycle by providing the book name, author, link (required), and optional notes. Suggestions are displayed anonymously to other users to prevent bias.

### `/chapters-view-suggestions`

**Short Description:** View all book suggestions  
**Usage Hint:** `/chapters-view-suggestions`  
Displays all books that have been suggested for the current reading cycle, including details like title, author, links, and notes. Suggestions are shown anonymously.

### `/chapters-vote`

**Short Description:** Vote for your favorite books  
**Usage Hint:** `/chapters-vote`  
Opens a voting UI where members can select their first, second, and third choices among the suggested books. Each vote allocates points in a ranked choice system (3 points for first choice, 2 for second, 1 for third).

### `/chapters-voting-results`

**Short Description:** View current voting results  
**Usage Hint:** `/chapters-voting-results`  
Shows the current standings in the voting process, with suggestions sorted by total points received. Displays medal emojis (🥇, 🥈, 🥉) for the top three books.

### `/chapters-complete-cycle`

**Short Description:** Complete and archive the current cycle  
**Usage Hint:** `/chapters-complete-cycle`  
Completes the current book club cycle, archives it, and allows a new cycle to be started. This command can only be used when the cycle is in the discussion phase.

### `/chapters-version`

**Short Description:** Show current bot version  
**Usage Hint:** `/chapters-version`  
Displays the current version of the Chapters bot, which is useful for troubleshooting and ensuring you're running the latest version.

### `/chapters-reset-cycle`

**Short Description:** Reset and delete the current cycle  
**Usage Hint:** `/chapters-reset-cycle`  
Emergency command that allows administrators to reset and delete the current book club cycle. This will:

- Delete all book suggestions
- Delete all votes
- Clear phase transition timers
- Allow starting a fresh cycle

⚠️ **Warning:** This action cannot be undone and should only be used in emergency situations.

## Book Club Cycle Lifecycle

1. **Start Cycle**: Run `/chapters-start-cycle` to start a new book club cycle
2. **Configuration**: Set up cycle name and phase durations (suggestion, voting, reading, discussion)
3. **Suggestion Phase**: Members suggest books using `/chapters-suggest-book`
4. **View Suggestions**: View all suggested books using `/chapters-view-suggestions`
5. **Voting Phase**: Members vote on their favorite books using `/chapters-vote`
6. **View Results**: Check voting results with `/chapters-voting-results`
7. **Reading Phase**: Read the winning book selection
8. **Discussion Phase**: Discuss the book with the group
9. **Complete Cycle**: End the cycle with `/chapters-complete-cycle`
10. **Check Status**: Monitor the current phase and deadlines with `/chapters-cycle-status`

## Phase Transition Messages

When the book club transitions between phases (either automatically or manually), the bot sends informative messages:

- **Voting Phase**: Lists all suggested books available for voting
- **Reading Phase**: Showcases the winning book with details including title, author, link, and notes
- **Discussion Phase**: Provides congratulatory messages and discussion prompts related to the selected book

These messages help guide members through each phase of the book club with relevant context and instructions.

## Development

### Application Architecture

The application is structured with a modular, maintainable architecture:

#### Core files:

- `src/index.ts` - Main entry point for both development and production environments
- `src/constants.ts` - Centralized configuration constants
- `src/config.ts` - Environment-specific configuration

#### Key directories:

- `src/validators/` - Input and environment validation
- `src/utils/` - Shared utilities including server, shutdown handling and version tracking
- `src/services/` - Core services like phase transitions
- `src/features/` - Command and event handlers
- `src/db/` - Database models and connection utilities
- `src/dto/` - Data transfer objects

### Test Mode for Rapid Phase Transitions

When testing the phase transition service, it's helpful to use shorter durations than the default days-long phases. The application includes a test mode that sets all phase durations to 1 minute for rapid testing:

1. Add `PHASE_TEST_MODE=true` to your `.env` file
2. Restart the application
3. When enabled, you'll see a console message: `🧪 TEST MODE ENABLED: All phase durations set to 1 minute`

This allows you to test the full cycle of phase transitions in just a few minutes instead of days or weeks, without modifying any production code.

### Error Handling Pattern

This application uses a standardized error handling pattern to reduce duplicate try/catch blocks across command handlers. The implementation is in `src/utils/errors.ts` and provides a higher-order function `withErrorHandling` that wraps command handlers.

Example usage:

```typescript
app.command(
  "/chapters-command",
  withErrorHandling(async ({ command, ack, client }) => {
    await ack();

    // Your command logic here...
    // No need for try/catch blocks!

    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: "Command completed successfully",
    });
  })
);
```

Benefits:

- Reduces code duplication
- Ensures consistent error responses
- Centralizes error logging
- Makes command handlers more readable

## Development Workflow

### Branching Strategy

1. **Main Branch**: `master` is the main branch and should always be in a deployable state
2. **Feature Branches**: Create feature branches from `master` using the following naming convention:
   - `feature/description-of-feature` for new features
   - `fix/description-of-fix` for bug fixes
   - `docs/description-of-docs` for documentation changes
   - `refactor/description-of-refactor` for code refactoring

### Making Changes

1. Create a new branch from `master`:

   ```bash
   git checkout master
   git pull origin master
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit them following the conventional commit format:

   ```
   type(scope): description

   [optional body]

   [optional footer]
   ```

   Types include:

   - `feat`: New feature
   - `fix`: Bug fix
   - `docs`: Documentation changes
   - `style`: Code style changes (formatting, etc.)
   - `refactor`: Code refactoring
   - `test`: Adding or modifying tests
   - `chore`: Maintenance tasks

3. Push your branch and create a Pull Request:
   ```bash
   git push origin feature/your-feature-name
   ```

### Pull Request Process

1. Create a Pull Request from your feature branch to `master`
2. Ensure all CI checks pass
3. Request review from at least one team member
4. Address any review comments
5. Once approved, squash and merge your PR into `master`

## Local Development

### Prerequisites

1. Node.js v16 or higher
2. npm
3. ngrok (for local testing with Slack)
4. A Slack workspace with permission to install apps
5. MongoDB (local or remote)

### Setup

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd Chapters
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root with the following variables:

   ```
   # Slack App Credentials
   SLACK_APP_BOT_TOKEN=xoxb-your-bot-token-here
   SLACK_APP_SIGNING_SECRET=your-signing-secret-here

   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/chapters

   # Application Configuration
   NODE_ENV=development
   USE_SOCKET_MODE=false
   ```

4. Start MongoDB (if using local instance):
   ```bash
   npm run db:start
   ```

### Running Locally for Slack Integration Testing

1. Start the development server in HTTP mode:

   ```bash
   npm run dev:http
   ```

2. In a separate terminal, start ngrok to create a tunnel to your local server:

   ```bash
   ngrok http 3000
   ```

3. Copy the ngrok URL (like `https://abc123.ngrok.io`) and set up your Slack app:

   - Go to your [Slack App Dashboard](https://api.slack.com/apps)
   - Select your app and navigate to **Event Subscriptions**
   - Enable events and set the Request URL to: `https://your-ngrok-url/slack/events`
   - Navigate to **Slash Commands** and update the command Request URLs to: `https://your-ngrok-url/slack/events`
   - Navigate to **Interactivity & Shortcuts** and set the Request URL to: `https://your-ngrok-url/slack/events`

4. Test your slash commands and interactions in Slack!

## Deployment to Vercel

### Prerequisites

1. A Vercel account
2. The Vercel CLI (optional for direct deployments)
3. A MongoDB database (Atlas recommended for production)

### Setup

1. Connect your repository to Vercel:

   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Import your Git repository
   - Configure the project settings

2. Set environment variables in Vercel:

   - `SLACK_APP_BOT_TOKEN`: Your Slack bot token
   - `SLACK_APP_SIGNING_SECRET`: Your Slack signing secret
   - `MONGODB_URI`: Your MongoDB connection URI
   - `NODE_ENV`: `production`
   - `USE_SOCKET_MODE`: `false`

3. Deploy to Vercel:

   ```bash
   vercel --prod
   ```

4. Once deployed, update your Slack app configuration:
   - Use `https://your-vercel-url/api/slack/events` for all Request URLs

## Available Scripts

- `npm run build`: Build the TypeScript files
- `npm run start`: Start the production server
- `npm run dev`: Start the development server using TypeScript and nodemon
- `npm run dev:http`: Start the HTTP API server for Slack integration with ngrok
- `npm run db:start`: Start a local MongoDB instance using Docker

## Project Structure

- `api/`: Vercel serverless functions
- `src/`: TypeScript source code
- `dist/`: Compiled JavaScript files
- `docs/`: Documentation files

## Deployment

See [SETUP.md](SETUP.md) for detailed deployment instructions.
