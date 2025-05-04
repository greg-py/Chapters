import { App } from "@slack/bolt";
import { withErrorHandling } from "../utils/errors";

export function registerUtilityCommands(app: App): void {
  // Simple ping command for testing
  app.command(
    "/chapters-ping",
    withErrorHandling(async ({ ack, say }) => {
      await ack();
      await say("Pong! Chapters is up and running!");
    })
  );

  // Help command
  app.command(
    "/chapters-help",
    withErrorHandling(async ({ ack, say }) => {
      await ack();
      await say({
        text: "Chapters Help",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*Chapters Commands*",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "• `/chapters-ping` - Check if the bot is running\n• `/chapters-help` - Show this help message\n• `/chapters-start-cycle [name]` - Start a new book club cycle\n• `/chapters-complete-cycle` - Complete the current book club cycle\n• `/chapters-cycles` - View book club cycle history\n• `/chapters-suggest [title] by [author] | url: [url] | notes: [notes]` - Suggest a book\n• `/chapters-list` - List all suggested books\n• `/chapters-vote` - Vote for books using ranked choice voting\n• `/chapters-vote-results` - Show voting results\n• `/chapters-set-phase` - Manually change the book club phase\n• `/chapters-status` - Check current book club status\n• `/chapters-clear-data` - Clear suggestions or votes",
            },
          },
        ],
      });
    })
  );
}
