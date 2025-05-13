import type { App, BlockAction } from "@slack/bolt";
import { Suggestion } from "../../services";
import { withActionErrorHandling } from "../../utils";
import { ActionId, BlockId } from "../../constants";
import {
  validateActiveCycleExists,
  validateSuggestionPrerequisites,
} from "../../validators";

/**
 * Registers all suggestion actions
 * @param app - The Slack app
 */
export const registerSuggestionActions = (app: App): void => {
  // Handler for submitting a book suggestion
  app.action(
    ActionId.SUBMIT_BOOK_SUGGESTION,
    withActionErrorHandling(async ({ body, client }) => {
      // ack() is called by the wrapper

      // Extract values and validate
      const blockAction = body as BlockAction;
      const userId = blockAction.user.id;
      const channelId = blockAction.channel?.id;

      if (!userId || !channelId) {
        throw new Error("Missing user or channel ID.");
      }

      // Validate cycle exists and is in suggestion phase
      const cycle = await validateActiveCycleExists(channelId);
      validateSuggestionPrerequisites(cycle);

      // Get suggestion details from form
      const values = blockAction.state?.values;
      if (!values) {
        throw new Error("Could not read suggestion values.");
      }

      const title =
        values[BlockId.BOOK_NAME]?.[ActionId.BOOK_NAME_INPUT]?.value;
      const author =
        values[BlockId.BOOK_AUTHOR]?.[ActionId.BOOK_AUTHOR_INPUT]?.value;
      const url =
        values[BlockId.BOOK_URL]?.[ActionId.BOOK_URL_INPUT]?.value || "";
      const notes =
        values[BlockId.BOOK_NOTES]?.[ActionId.BOOK_NOTES_INPUT]?.value || "";

      // Validate required fields
      if (!title || !author || !url) {
        throw new Error("Book title, author, and link are required.");
      }

      // Basic URL validation
      try {
        new URL(url);
      } catch (_) {
        throw new Error(
          "Invalid Link format. Please enter a valid URL (e.g., https://... )."
        );
      }

      // Create the suggestion
      await Suggestion.createNew(
        cycle.getId(),
        userId,
        title,
        author,
        url,
        notes
      );

      // Send confirmation to user
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: `✅ Your suggestion "${title}" by ${author} has been added to the book club cycle!`,
      });

      // Post announcement in the channel
      await client.chat.postMessage({
        channel: channelId,
        text: `:books: A new book has been suggested: *<${url}|${title}>* by ${author}${
          notes ? `\n\n*Notes:* ${notes}` : ""
        }`,
      });
    })
  );

  // Handler for canceling a book suggestion
  app.action(
    ActionId.CANCEL_PHASE_CHANGE, // Reusing existing action for cancel
    withActionErrorHandling(async ({ body, client }) => {
      // ack() is called by the wrapper

      const blockAction = body as BlockAction;
      const userId = blockAction.user.id;
      const channelId = blockAction.channel?.id;

      if (!userId || !channelId) {
        console.warn("Cancel suggestion action missing user or channel ID.");
        return;
      }

      // Send an ephemeral message to confirm cancellation
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: "Book suggestion canceled.",
      });
    })
  );
};
