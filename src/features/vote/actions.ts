import type { App, BlockAction } from "@slack/bolt";
import { withActionErrorHandling } from "../../utils";
import { ActionId, BlockId } from "../../constants";
import {
  validateActiveCycleExists,
  validateVotingPrerequisites,
} from "../../validators";
import { sendVoteConfirmationMessage } from "./ui";
import { Vote } from "../../services";

/**
 * Registers all vote actions
 * @param app - The Slack app
 */
export const registerVoteActions = (app: App): void => {
  // Submit vote handler
  app.action(
    ActionId.SUBMIT_VOTE,
    withActionErrorHandling(async ({ body, client }) => {
      // ack() is called by the wrapper

      const blockAction = body as BlockAction;
      const userId = blockAction.user.id;
      const channelId = blockAction.channel?.id;

      if (!userId || !channelId) {
        throw new Error("Missing user or channel ID.");
      }

      // Validate cycle exists and is in voting phase
      const cycle = await validateActiveCycleExists(channelId);
      const suggestions = await validateVotingPrerequisites(
        cycle,
        userId,
        false
      );

      // Get vote choices from state
      const values = blockAction.state?.values;
      if (!values) {
        throw new Error("Could not read vote selection values.");
      }

      // Get selected suggestion IDs
      const firstChoiceId =
        values[BlockId.FIRST_CHOICE]?.[ActionId.FIRST_CHOICE_SELECT]
          ?.selected_option?.value;
      const secondChoiceId =
        values[BlockId.SECOND_CHOICE]?.[ActionId.SECOND_CHOICE_SELECT]
          ?.selected_option?.value;
      const thirdChoiceId =
        values[BlockId.THIRD_CHOICE]?.[ActionId.THIRD_CHOICE_SELECT]
          ?.selected_option?.value;

      // Validate that all three choices are selected
      if (!firstChoiceId || !secondChoiceId || !thirdChoiceId) {
        throw new Error(
          "You must select all three choices to cast your vote. Please select a first, second, and third choice book."
        );
      }

      // Check for duplicates
      const selectedIds = [firstChoiceId, secondChoiceId, thirdChoiceId];
      if (new Set(selectedIds).size !== selectedIds.length) {
        throw new Error("Please select different books for each choice.");
      }

      // Record the vote
      await Vote.submitVote({
        userId,
        cycleId: cycle.getId(),
        firstChoice: firstChoiceId,
        secondChoice: secondChoiceId,
        thirdChoice: thirdChoiceId,
      });

      // Send confirmation to the user
      await sendVoteConfirmationMessage(client, channelId, userId, {
        firstChoice: firstChoiceId,
        secondChoice: secondChoiceId,
        thirdChoice: thirdChoiceId,
      });
    })
  );

  // Individual choice selection handlers (just to acknowledge)
  app.action(
    ActionId.FIRST_CHOICE_SELECT,
    withActionErrorHandling(async () => {
      // Just acknowledge the action, no additional handler needed
    })
  );

  app.action(
    ActionId.SECOND_CHOICE_SELECT,
    withActionErrorHandling(async () => {
      // Just acknowledge the action, no additional handler needed
    })
  );

  app.action(
    ActionId.THIRD_CHOICE_SELECT,
    withActionErrorHandling(async () => {
      // Just acknowledge the action, no additional handler needed
    })
  );
};
