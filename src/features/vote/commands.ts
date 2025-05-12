import { App } from "@slack/bolt";
import { withErrorHandling } from "../../utils";
import {
  validateVotingPrerequisites,
  validateActiveCycleExists,
} from "../../validators";
import { Suggestion } from "../../services";
import { sendVoteUI, sendVotingResultsUI } from "./ui";

/**
 * Registers all vote commands
 * @param app - The Slack app
 */
export const registerVoteCommands = (app: App): void => {
  // Command to vote on suggestions
  app.command(
    "/chapters-vote",
    withErrorHandling(async ({ command, ack, client }) => {
      await ack();

      // Validate cycle exists
      const cycle = await validateActiveCycleExists(command.channel_id);

      // Validate voting prerequisites (phase, suggestion count, user vote status)
      const suggestions = await validateVotingPrerequisites(
        cycle,
        command.user_id,
        true // Check if user has voted
      );

      await sendVoteUI(client, command, suggestions);
    })
  );

  // Command to view voting results
  app.command(
    "/chapters-voting-results",
    withErrorHandling(async ({ command, ack, client }) => {
      await ack();

      // Validate cycle exists
      const cycle = await validateActiveCycleExists(command.channel_id);
      // No specific phase required to view results, but might want to check if voting/reading/discussion phase?
      // validateCyclePhase(cycle, [CyclePhase.VOTING, CyclePhase.READING, CyclePhase.DISCUSSION], 'results viewing'); // Optional enhancement

      const suggestions = await Suggestion.getAllForCycle(cycle.getId());

      await sendVotingResultsUI(client, command, suggestions);
    })
  );
};
