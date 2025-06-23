import type { App, BlockAction } from "@slack/bolt";
import { withActionErrorHandling } from "../../utils";
import { ActionId, BlockId } from "../../constants";
import {
  validateActiveCycleExists,
  validateCyclePhase,
} from "../../validators";
import { CyclePhase } from "../../constants";
import { Rating } from "../../services";

/**
 * Registers all discussion actions
 * @param app - The Slack app
 */
export const registerDiscussionActions = (app: App): void => {
  // Submit rating handler
  app.action(
    ActionId.SUBMIT_RATING,
    withActionErrorHandling(async ({ body, client, respond }) => {
      // ack() is called by the wrapper

      const blockAction = body as BlockAction;
      const userId = blockAction.user.id;
      const channelId = blockAction.channel?.id;

      if (!userId || !channelId) {
        throw new Error("Missing user or channel ID.");
      }

      // Validate cycle exists and is in discussion phase
      const cycle = await validateActiveCycleExists(channelId);
      validateCyclePhase(cycle, CyclePhase.DISCUSSION, "book rating");

      // Check if user has already rated
      const hasRated = await Rating.hasUserRatedInCycle(userId, cycle.getId());
      if (hasRated) {
        throw new Error(
          "You have already rated this book. Use `/chapters-rating-results` to see the current ratings."
        );
      }

      // Get rating values from state
      const values = blockAction.state?.values;
      if (!values) {
        throw new Error("Could not read rating values.");
      }

      // Get selected rating and recommendation
      const ratingStr =
        values[BlockId.BOOK_RATING]?.[ActionId.RATING_SELECT]?.selected_option
          ?.value;
      const recommendStr =
        values[BlockId.BOOK_RECOMMEND]?.[ActionId.RECOMMEND_SELECT]
          ?.selected_option?.value;

      if (!ratingStr || !recommendStr) {
        throw new Error(
          "Please select both a rating and recommendation before submitting."
        );
      }

      const rating = parseInt(ratingStr, 10);
      const recommend = recommendStr === "yes";

      if (isNaN(rating) || rating < 1 || rating > 10) {
        throw new Error(
          "Invalid rating value. Please select a rating from 1-10."
        );
      }

      // Get the selected book for this cycle
      const selectedBookId = cycle.getSelectedBookId();
      if (!selectedBookId) {
        throw new Error(
          "No book has been selected for this cycle. Please contact an administrator."
        );
      }

      // Record the rating
      await Rating.submitRating({
        userId,
        cycleId: cycle.getId(),
        bookId: selectedBookId,
        rating,
        recommend,
      });

      // Send confirmation to the user by replacing the original message
      await respond({
        text: `✅ Your rating has been recorded successfully! You rated the book ${rating}/10 and ${
          recommend ? "would" : "would not"
        } recommend it to others.`,
        replace_original: true,
      });
    })
  );

  // Rating selection handlers (just to acknowledge)
  app.action(
    ActionId.RATING_SELECT,
    withActionErrorHandling(async () => {
      // Just acknowledge the action, no additional handler needed
    })
  );

  app.action(
    ActionId.RECOMMEND_SELECT,
    withActionErrorHandling(async () => {
      // Just acknowledge the action, no additional handler needed
    })
  );

  app.action(
    ActionId.CANCEL_RATING,
    withActionErrorHandling(async ({ body, respond }) => {
      // ack() is called by the wrapper

      const blockAction = body as BlockAction;
      const userId = blockAction.user.id;
      const channelId = blockAction.channel?.id;

      if (!userId || !channelId) {
        console.warn("Cancel rating action missing user or channel ID.");
        return;
      }

      await respond({
        text: "Rating canceled. The form has been dismissed.",
        replace_original: true,
      });
    })
  );
};
