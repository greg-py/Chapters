import { SlackCommandMiddlewareArgs } from "@slack/bolt";

/**
 * Wraps a command handler with standardized error handling.
 * Any errors thrown within the handler will be caught and sent as an ephemeral message
 * to the user who triggered the command.
 *
 * @param handler The command handler function to wrap
 * @returns The wrapped handler with error handling
 */
export function withErrorHandling<
  T extends SlackCommandMiddlewareArgs & { client: any }
>(handler: (args: T) => Promise<void>): (args: T) => Promise<void> {
  return async (args: T) => {
    try {
      await handler(args);
    } catch (error) {
      console.error("Command error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      await args.client.chat.postEphemeral({
        channel: args.command.channel_id,
        user: args.command.user_id,
        text: errorMessage,
      });
    }
  };
}
