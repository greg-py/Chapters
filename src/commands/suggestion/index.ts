import { App } from "@slack/bolt";
import { withErrorHandling } from "../../utils/errors";
import { Cycle, Suggestion } from "../../services";
import { sendBookSuggestionUI, sendSuggestionsListUI } from "./configuration";

/**
 * Registers all suggestion commands
 * @param app - The Slack app
 */
export const registerSuggestionCommands = (app: App) => {
  // Command to open suggestion UI to add a book suggestion to the cycle
  app.command(
    "/chapters-suggest-book",
    withErrorHandling(async ({ command, ack, client }) => {
      await ack();

      const cycle = await Cycle.getActive(command.channel_id);

      if (!cycle) {
        throw new Error("No active cycle found for this channel.");
      }

      await sendBookSuggestionUI(client, command);
    })
  );

  // Command to post the current cycle's book suggestions list to the channel
  app.command(
    "/chapters-view-suggestions",
    withErrorHandling(async ({ command, ack, client }) => {
      await ack();

      const cycle = await Cycle.getActive(command.channel_id);

      if (!cycle) {
        throw new Error("No active cycle found for this channel.");
      }

      const suggestions = await Suggestion.getAllForCycle(cycle.getId());

      await sendSuggestionsListUI(client, command, suggestions);
    })
  );
};
