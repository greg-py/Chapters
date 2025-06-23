import { App } from "@slack/bolt";
import { withErrorHandling } from "../../utils";
import {
  validateActiveCycleExists,
  validateCyclePhase,
} from "../../validators";
import { CyclePhase } from "../../constants";
import { Rating, Suggestion } from "../../services";
import { sendRatingUI, sendRatingResultsUI } from "./ui";

/**
 * Registers all discussion commands
 * @param app - The Slack app
 */
export const registerDiscussionCommands = (app: App): void => {
  // Command to rate the book
  app.command(
    "/chapters-rate-book",
    withErrorHandling(async ({ command, client }) => {
      // Validate cycle exists
      const cycle = await validateActiveCycleExists(command.channel_id);

      // Validate that the cycle is in discussion phase
      validateCyclePhase(cycle, CyclePhase.DISCUSSION, "book rating");

      // Check if user has already rated
      const hasRated = await Rating.hasUserRatedInCycle(
        command.user_id,
        cycle.getId()
      );

      if (hasRated) {
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: "You have already rated this book. Use `/chapters-rating-results` to see the current ratings.",
        });
        return;
      }

      // Get the selected book for this cycle
      const selectedBookId = cycle.getSelectedBookId();
      if (!selectedBookId) {
        throw new Error(
          "No book has been selected for this cycle. Please contact an administrator."
        );
      }

      const selectedBook = await Suggestion.getById(selectedBookId);
      if (!selectedBook) {
        throw new Error(
          "Selected book not found. Please contact an administrator."
        );
      }

      await sendRatingUI(client, command, selectedBook);
    })
  );

  // Command to view rating results
  app.command(
    "/chapters-rating-results",
    withErrorHandling(async ({ command, client }) => {
      // Validate cycle exists
      const cycle = await validateActiveCycleExists(command.channel_id);

      // Validate that the cycle is in discussion phase
      validateCyclePhase(
        cycle,
        CyclePhase.DISCUSSION,
        "rating results viewing"
      );

      // Get the selected book for this cycle
      const selectedBookId = cycle.getSelectedBookId();
      if (!selectedBookId) {
        throw new Error(
          "No book has been selected for this cycle. Please contact an administrator."
        );
      }

      const selectedBook = await Suggestion.getById(selectedBookId);
      if (!selectedBook) {
        throw new Error(
          "Selected book not found. Please contact an administrator."
        );
      }

      // Get rating statistics
      const stats = await Rating.getStatsForCycle(cycle.getId());

      await sendRatingResultsUI(client, command, selectedBook, stats);
    })
  );
};
