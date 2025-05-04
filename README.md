# Chapters: Book Club Management Bot for Slack

Chapters is a comprehensive Slack bot designed to streamline book club management. It automates the entire book club lifecycle, from collecting book suggestions to facilitating discussions.

## Features

- **Book Club Cycles**: Manage complete book club cycles from start to finish with archiving and statistics
- **Configurable Phases**: Customize the duration of each book club phase (suggestion, voting, reading, discussion)
- **Book Suggestions**: Members can suggest books with details like author, URL, and notes
- **Ranked Choice Voting**: Vote for preferred books using a ranked choice system
- **Book Club Status**: Check the current status and phase of the book club
- **Cycle History**: View past book club cycles with statistics and winning books

## Getting Started

1. Install the Chapters app to your Slack workspace
2. Invite the bot to your book club channel
3. Run `/chapters-start-cycle` to configure the book club and start the first cycle
4. Follow the natural progression from suggestions → voting → reading → discussion
5. After the book discussion, use `/chapters-complete-cycle` to archive the cycle and view stats

## Command Reference

Here's a complete list of all available commands:

| Command                      | Short Description               | Usage Hint                   |
| ---------------------------- | ------------------------------- | ---------------------------- |
| `/chapters-ping`             | Check if the bot is running     | `/chapters-ping`             |
| `/chapters-help`             | Show list of available commands | `/chapters-help`             |
| `/chapters-start-cycle`      | Start a new book club cycle     | `/chapters-start-cycle`      |
| `/chapters-cycle-status`     | Check current cycle information | `/chapters-cycle-status`     |
| `/chapters-set-phase`        | Manually change book club phase | `/chapters-set-phase`        |
| `/chapters-suggest-book`     | Open UI to suggest a book       | `/chapters-suggest-book`     |
| `/chapters-view-suggestions` | View all book suggestions       | `/chapters-view-suggestions` |

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
Shows the current status of the active book club cycle, including cycle name, current phase, and phase deadline.

### `/chapters-set-phase`

**Short Description:** Manually change book club phase  
**Usage Hint:** `/chapters-set-phase`  
Opens a UI where you can select which phase to transition to (suggestion, voting, reading, or discussion). After confirmation, the cycle will be updated to the new phase and an announcement will be posted to the channel.

### `/chapters-suggest-book`

**Short Description:** Open UI to suggest a book  
**Usage Hint:** `/chapters-suggest-book`  
Opens a form UI where members can suggest a book for the current cycle by providing the book name, author, link, and optional notes.

### `/chapters-view-suggestions`

**Short Description:** View all book suggestions  
**Usage Hint:** `/chapters-view-suggestions`  
Displays all books that have been suggested for the current reading cycle, including details like title, author, links, and notes.

## Book Club Cycle Lifecycle

1. **Start Cycle**: Run `/chapters-start-cycle` to start a new book club cycle
2. **Configuration**: Set up cycle name and phase durations (suggestion, voting, reading, discussion)
3. **Suggestion Phase**: Members suggest books using `/chapters-suggest-book`
4. **View Suggestions**: View all suggested books using `/chapters-view-suggestions`
5. **Change Phases**: Transition between phases using `/chapters-set-phase` when ready
6. **Check Status**: Monitor the current phase and deadlines with `/chapters-cycle-status`

## Development

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
