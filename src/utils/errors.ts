import {
  SlackCommandMiddlewareArgs,
  SlackActionMiddlewareArgs,
  AckFn,
} from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import { BlockAction, ViewSubmitAction } from "@slack/bolt";

// Helper function to send ephemeral error messages
const sendEphemeralError = async (
  client: WebClient,
  errorMessage: string,
  channelId?: string,
  userId?: string
) => {
  if (channelId && userId) {
    try {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: `❌ Error: ${errorMessage}`,
      });
    } catch (ephemeralError) {
      console.error("Failed to send ephemeral error message:", ephemeralError);
    }
  } else if (userId) {
    // Fallback if only user is known (e.g., view submission without channel context)
    console.warn(
      `Could not send ephemeral error to channel (channelId unknown), user: ${userId}, error: ${errorMessage}`
    );
    // Optionally, send a DM if channel is unknown? Requires users:read scope.
    // await client.chat.postMessage({ channel: userId, text: `❌ Error: ${errorMessage}` });
  } else {
    console.error(
      "Could not send ephemeral error: Missing channelId and/or userId."
    );
  }
};

/**
 * Wraps a command handler with standardized error handling.
 * Any errors thrown within the handler will be caught and sent as an ephemeral message
 * to the user who triggered the command.
 *
 * @param handler The command handler function to wrap
 * @returns The wrapped handler with error handling
 */
export function withErrorHandling<
  T extends SlackCommandMiddlewareArgs & { client: WebClient }
>(handler: (args: T) => Promise<void>): (args: T) => Promise<void> {
  return async (args: T) => {
    // Extract ack to call it first and save client/command for potential error handling
    const { ack, client, command } = args;

    // Always acknowledge the command first thing - this is critical
    try {
      await ack();
    } catch (ackError) {
      console.error("Failed to acknowledge command:", ackError);
    }

    try {
      // Run the handler with all original parameters
      await handler(args);
    } catch (error) {
      console.error("Command error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";

      // Send an ephemeral error message to the user
      if (command && command.channel_id && command.user_id) {
        await sendEphemeralError(
          client,
          errorMessage,
          command.channel_id,
          command.user_id
        );
      }
    }
  };
}

// Type definition for Action bodies we handle
type HandledActionBody =
  | BlockAction // Includes button clicks, select menus in blocks
  // Add other action body types here if needed in the future
  // | InteractiveMessage
  // | DialogSubmitAction
  | ViewSubmitAction; // For modal submissions
// | WorkflowStepEdit;

/**
 * Wraps an action handler with standardized error handling.
 * It automatically acknowledges the action (if ack is provided).
 * Any errors thrown within the handler will be caught and sent as an ephemeral message
 * to the user who triggered the action.
 *
 * @param handler The action handler function to wrap
 * @returns The wrapped handler with error handling
 */
export function withActionErrorHandling<
  T extends SlackActionMiddlewareArgs & {
    client: WebClient;
    body: HandledActionBody;
  }
>(handler: (args: T) => Promise<void>): (args: T) => Promise<void> {
  return async (args: T) => {
    const ack = args.ack as AckFn<any> | undefined;
    let ackFailed = false;
    if (ack && typeof ack === "function") {
      try {
        await ack();
      } catch (ackError) {
        ackFailed = true;
        console.error("Failed to acknowledge action:", ackError);
      }
    }

    // Determine user/channel IDs *before* potentially exiting due to ack failure
    let channelId: string | undefined;
    let userId: string | undefined;
    const body = args.body; // Narrow type

    if (body.type === "block_actions") {
      channelId = body.channel?.id;
      userId = body.user.id;
    } else if (body.type === "view_submission") {
      userId = body.user.id;
      // channelId might be in body.view.private_metadata if you passed it
      // Example: const metadata = JSON.parse(body.view.private_metadata || '{}'); channelId = metadata.channelId;
    }
    // Add cases for other HandledActionBody types if necessary

    if (ackFailed) {
      const errorMessage = "Sorry, there was an issue processing your action.";
      await sendEphemeralError(args.client, errorMessage, channelId, userId);
      return; // Stop processing if ack fails
    }

    try {
      await handler(args);
    } catch (error) {
      console.error("Action error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      // We already determined channelId and userId above
      await sendEphemeralError(args.client, errorMessage, channelId, userId);
    }
  };
}
