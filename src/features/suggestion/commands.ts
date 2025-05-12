import type { App } from "@slack/bolt";
import { withErrorHandling } from "../../utils";
import { Suggestion } from "../../services";
import {
  validateActiveCycleExists,
  validateSuggestionPrerequisites,
} from "../../validators";
import { sendBookSuggestionUI, sendSuggestionsListUI } from "./ui";

/**
 * Registers all suggestion commands
 * @param app - The Slack app
 */
export const registerSuggestionCommands = (app: App): void => {
  // Command to open suggestion UI to add a book suggestion to the cycle
  app.command(
    "/chapters-suggest-book",
    withErrorHandling(async ({ command, client }) => {
      // Validate cycle exists and is in suggestion phase
      const cycle = await validateActiveCycleExists(command.channel_id);
      validateSuggestionPrerequisites(cycle);

      await sendBookSuggestionUI(client, command);
    })
  );

  // Command to post the current cycle's book suggestions list to the channel
  app.command(
    "/chapters-view-suggestions",
    withErrorHandling(async ({ command, client }) => {
      // Validate cycle exists
      const cycle = await validateActiveCycleExists(command.channel_id);
      // No specific phase required to view suggestions

      const suggestions = await Suggestion.getAllForCycle(cycle.getId());

      await sendSuggestionsListUI(client, command, suggestions);
    })
  );
};
