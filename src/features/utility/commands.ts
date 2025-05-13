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
    withErrorHandling(async ({ say }) => {
      await say("Pong! Chapters is up and running!");
    })
  );

  // Version command
  app.command(
    "/chapters-version",
    withErrorHandling(async ({ say }) => {
      const version =
        process.env.APP_VERSION || require("../../../package.json").version;
      await say({
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
    withErrorHandling(async ({ say }) => {
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
              text: "• `/chapters-ping` - Check if the bot is running\n• `/chapters-help` - Show this help message\n• `/chapters-version` - Show current version\n• `/chapters-start-cycle` - Start a new book club cycle\n• `/chapters-cycle-status` - Check current cycle information\n• `/chapters-set-phase` - Manually change book club phase\n• `/chapters-suggest-book` - Open UI to suggest a book\n• `/chapters-view-suggestions` - View all book suggestions\n• `/chapters-vote` - Vote for your favorite books\n• `/chapters-voting-results` - View current voting results\n• `/chapters-complete-cycle` - Complete and archive the current cycle\n• `/chapters-reset-cycle` - Reset and delete the current cycle (emergency)",
            },
          },
        ],
      });
    })
  );
}
