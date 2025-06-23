import type { App } from "@slack/bolt";
import { withErrorHandling } from "../../utils";

/**
 * Registers utility commands (help, ping)
 * @param app - The Slack app
 */
export function registerUtilityCommands(app: App): void {
  // Simple ping command for testing
  app.command(
    "/chapters-ping",
    withErrorHandling(async ({ command, client }) => {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: "Pong! Chapters is up and running!",
      });
    })
  );

  // Version command
  app.command(
    "/chapters-version",
    withErrorHandling(async ({ command, client }) => {
      const version =
        process.env.APP_VERSION || require("../../../package.json").version;
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `Chapters Version: ${version}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Chapters Version*\nCurrent version: \`${version}\``,
            },
          },
        ],
      });
    })
  );

  // Help command
  app.command(
    "/chapters-help",
    withErrorHandling(async ({ command, client }) => {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
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
              text: "• `/chapters-ping` - Check if the bot is running\n• `/chapters-help` - Show this help message\n• `/chapters-version` - Show current version\n• `/chapters-start-cycle` - Start a new book club cycle\n• `/chapters-cycle-status` - Check current cycle information\n• `/chapters-set-phase` - Manually change book club phase\n• `/chapters-suggest-book` - Open UI to suggest a book\n• `/chapters-view-suggestions` - View all book suggestions\n• `/chapters-vote` - Vote for your favorite books\n• `/chapters-voting-results` - View current voting results\n• `/chapters-rate-book` - Rate the selected book (discussion phase)\n• `/chapters-rating-results` - View book rating results (discussion phase)\n• `/chapters-complete-cycle` - Complete and archive the current cycle\n• `/chapters-reset-cycle` - Reset and delete the current cycle (emergency)",
            },
          },
        ],
      });
    })
  );
}
