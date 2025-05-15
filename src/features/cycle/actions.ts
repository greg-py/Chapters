import type { App, BlockAction } from "@slack/bolt";
import { Suggestion, Vote } from "../../services";
import { capitalizeFirstLetter, withActionErrorHandling } from "../../utils";
import { ActionId, BlockId, CyclePhase } from "../../constants";
import { validateActiveCycleExists } from "../../validators";
import { ObjectId } from "mongodb";
import { phaseTransitionService } from "../../index";
import { connectToDatabase } from "../../db";
import {
  deleteVotesByCycle,
  deleteSuggestionsByCycle,
  deleteCycleById,
} from "../../dto";

/**
 * Registers all cycle actions
 * @param app - The Slack app
 */
export const registerCycleActions = (app: App): void => {
  // FORM SUBMISSION: Handler for new book club cycle configuration
  app.action(
    ActionId.SUBMIT_CYCLE_CONFIG,
    withActionErrorHandling(async ({ body, client, respond }) => {
      // ack() is called by the wrapper

      const blockAction = body as BlockAction;
      const userId = blockAction.user.id;
      const channelId = blockAction.channel?.id;

      if (!userId || !channelId) {
        throw new Error("Missing user or channel ID in request.");
      }

      // Make sure there's an active cycle to configure
      const cycle = await validateActiveCycleExists(channelId);

      // Extract values from the form using block_id and action_id
      const values = blockAction.state?.values;
      if (!values) {
        throw new Error("Could not read form values. Please try again.");
      }

      const cycleName =
        values[BlockId.CYCLE_NAME]?.[ActionId.CYCLE_NAME_INPUT]?.value;
      const suggestionPhaseDuration = parseInt(
        values[BlockId.SUGGESTION_DURATION]?.[ActionId.SUGGESTION_DAYS_INPUT]
          ?.value || "0",
        10
      );
      const votingPhaseDuration = parseInt(
        values[BlockId.VOTING_DURATION]?.[ActionId.VOTING_DAYS_INPUT]?.value ||
          "0",
        10
      );
      const readingPhaseDuration = parseInt(
        values[BlockId.READING_DURATION]?.[ActionId.READING_DAYS_INPUT]
          ?.value || "0",
        10
      );
      const discussionPhaseDuration = parseInt(
        values[BlockId.DISCUSSION_DURATION]?.[ActionId.DISCUSSION_DAYS_INPUT]
          ?.value || "0",
        10
      );

      // Validate inputs
      if (!cycleName) {
        throw new Error("Cycle Name is required. Please enter a valid name.");
      }

      // Check if we're in test mode
      const isTestMode = process.env.PHASE_TEST_MODE === "true";

      // If in test mode, we'll use the getPhaseConfig() function directly instead of form values
      if (isTestMode) {
        // Update the cycle with test mode durations
        const { getPhaseConfig } = await import("../../config");
        const testPhaseDurations = getPhaseConfig();

        const updatedCycle = await cycle.update({
          name: cycleName,
          phaseDurations: testPhaseDurations,
          currentPhase: CyclePhase.SUGGESTION, // Start in suggestion phase after config
        });

        // Notify the phase transition service about the updated cycle
        phaseTransitionService.onCycleUpdated(updatedCycle);

        // Post confirmation message to user by replacing the original message
        await respond({
          text: `✅ Book club cycle "${updatedCycle.getName()}" configured successfully with 🧪 TEST MODE (1 minute phases) and moved to the suggestion phase! Members can now suggest books using the \`/chapters-suggest-book\` command.`,
          replace_original: true,
        });

        // Post announcement in the channel
        await client.chat.postMessage({
          channel: channelId,
          text: `:books: *Book Club Cycle Started in TEST MODE!*\n\nA new book club cycle "${updatedCycle.getName()}" has been started in this channel with 1-minute phase durations for testing.\n\nWe are now in the *${capitalizeFirstLetter(
            CyclePhase.SUGGESTION
          )} Phase*. Use \`/chapters-suggest-book\` to suggest books for this cycle.\n\nThe suggestion phase will end in 1 minute.`,
        });

        return;
      }

      // For normal mode, validate the form values
      if (
        isNaN(suggestionPhaseDuration) ||
        isNaN(votingPhaseDuration) ||
        isNaN(readingPhaseDuration) ||
        isNaN(discussionPhaseDuration) ||
        suggestionPhaseDuration <= 0 ||
        votingPhaseDuration <= 0 ||
        readingPhaseDuration <= 0 ||
        discussionPhaseDuration <= 0
      ) {
        throw new Error(
          "All phase durations must be positive numbers. Please enter valid numbers."
        );
      }

      // Update the cycle (already validated it exists)
      const updatedCycle = await cycle.update({
        name: cycleName,
        phaseDurations: {
          suggestion: suggestionPhaseDuration,
          voting: votingPhaseDuration,
          reading: readingPhaseDuration,
          discussion: discussionPhaseDuration,
        },
        currentPhase: CyclePhase.SUGGESTION, // Start in suggestion phase after config
      });

      // Notify the phase transition service about the updated cycle
      phaseTransitionService.onCycleUpdated(updatedCycle);

      // Post confirmation message to user by replacing the original message
      await respond({
        text: `✅ Book club cycle "${updatedCycle.getName()}" configured successfully and moved to the suggestion phase! Members can now suggest books using the \`/chapters-suggest-book\` command.`,
        replace_original: true,
      });

      // Post announcement in the channel
      await client.chat.postMessage({
        channel: channelId,
        text: `:books: *Book Club Cycle Started!*\n\nA new book club cycle "${updatedCycle.getName()}" has been started in this channel.\n\nWe are now in the *${capitalizeFirstLetter(
          CyclePhase.SUGGESTION
        )} Phase*. Use \`/chapters-suggest-book\` to suggest books for this cycle.\n\nThe suggestion phase will end in ${suggestionPhaseDuration} days.`,
      });
    })
  );

  // Phase selection dropdown interaction - just ack
  app.action(
    ActionId.SELECT_PHASE,
    withActionErrorHandling(async () => {})
  );

  // Handler for confirming phase change
  app.action(
    ActionId.CONFIRM_PHASE_CHANGE,
    withActionErrorHandling(async ({ body, client, respond }) => {
      // ack() is called by the wrapper

      const blockAction = body as BlockAction;
      const userId = blockAction.user.id;
      const channelId = blockAction.channel?.id;
      if (!userId || !channelId) throw new Error("Missing user or channel ID.");

      // Validate active cycle exists
      const cycle = await validateActiveCycleExists(channelId);
      const currentPhase = cycle.getCurrentPhase();

      // Get and validate the selected phase from the dropdown
      const values = blockAction.state?.values;
      if (!values) throw new Error("Could not read phase selection from form.");
      const selectedPhaseValue =
        values[BlockId.PHASE_SELECTION]?.[ActionId.SELECT_PHASE]
          ?.selected_option?.value;

      if (!selectedPhaseValue) {
        await respond({
          text: "⚠️ Please select a phase before confirming.",
          replace_original: true,
        });
        return; // Don't throw, just inform user
      }

      const selectedPhase = selectedPhaseValue as CyclePhase;
      if (!Object.values(CyclePhase).includes(selectedPhase)) {
        // This indicates a potential issue with the UI options vs Enum
        // For system errors like this, replacing the original message might be confusing if it's an input form.
        // Throwing an error will be caught by withActionErrorHandling, which sends a new ephemeral error.
        // This is acceptable as it's an unexpected system state.
        throw new Error(`Invalid phase value selected: ${selectedPhaseValue}`);
      }

      // Get current book suggestions for the cycle
      const suggestions = await Suggestion.getAllForCycle(cycle.getId());

      // --- VALIDATION RULES ---

      // RULE 1: If currently in suggestion phase, need at least 3 suggestions to move on
      if (
        currentPhase === CyclePhase.SUGGESTION &&
        selectedPhase !== CyclePhase.SUGGESTION &&
        suggestions.length < 3
      ) {
        await respond({
          text: `⚠️ At least 3 book suggestions are required before moving to the ${capitalizeFirstLetter(
            selectedPhase
          )} phase. Currently have ${suggestions.length} suggestion${
            suggestions.length === 1 ? "" : "s"
          }.`,
          replace_original: true,
        });
        return;
      }

      // RULE 2: If moving to reading or discussion phase, must have a selected book
      const selectedBookId = cycle.getSelectedBookId();
      if (
        (selectedPhase === CyclePhase.READING ||
          selectedPhase === CyclePhase.DISCUSSION) &&
        !selectedBookId
      ) {
        // If coming from voting phase, we could try to auto-select the winner book
        if (currentPhase === CyclePhase.VOTING) {
          // Check if there are any votes at all
          const hasAnyVotes = suggestions.some((s) => s.getTotalPoints() > 0);
          if (!hasAnyVotes) {
            await respond({
              text: `⚠️ No votes have been cast yet. Members need to vote using \`/chapters-vote\` before moving to the ${capitalizeFirstLetter(
                selectedPhase
              )} phase.`,
              replace_original: true,
            });
            return;
          }

          // Sort suggestions by votes to get the winner
          const winner = [...suggestions].sort(
            (a, b) => b.getTotalPoints() - a.getTotalPoints()
          )[0];

          // Confirm with the user that we'll select this book
          // This posts a NEW ephemeral message with its own buttons.
          // So, no replace_original: true here. The original phase selection UI remains.
          // Actions from THIS new message (SELECT_BOOK_AND_CHANGE_PHASE, CANCEL_PHASE_CHANGE)
          // have already been updated to use respond({replace_original: true}) for THEIR ephemeral message.
          await client.chat.postEphemeral({
            channel: channelId,
            user: userId,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `Based on voting results, *\"${winner.getBookName()}\"* by *${winner.getAuthor()}* will be selected as the book for this cycle.`,
                },
              },
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: {
                      type: "plain_text",
                      text: "Confirm Selection & Change Phase",
                      emoji: true,
                    },
                    style: "primary",
                    value: JSON.stringify({
                      phase: selectedPhase,
                      bookId: winner.getId().toString(),
                    }),
                    action_id: ActionId.SELECT_BOOK_AND_CHANGE_PHASE,
                  },
                  {
                    type: "button",
                    text: {
                      type: "plain_text",
                      text: "Cancel",
                      emoji: true,
                    },
                    style: "danger",
                    action_id: ActionId.CANCEL_PHASE_CHANGE,
                  },
                ],
              },
            ],
            text: `Confirm book selection: \"${winner.getBookName()}\" by ${winner.getAuthor()}`,
          });
          return;
        } else {
          // Not coming from voting phase - need to select a book first
          await respond({
            text: `⚠️ A book must be selected before moving to the ${capitalizeFirstLetter(
              selectedPhase
            )} phase. Complete the voting process first.`,
            replace_original: true,
          });
          return;
        }
      }

      // RULE 3: If moving back to suggestion phase, clear selected book and votes
      let updateData: {
        currentPhase: CyclePhase;
        selectedBookId?: null;
      } = { currentPhase: selectedPhase };

      let confirmationMsg = `✅ The book club cycle has been moved to the ${capitalizeFirstLetter(
        selectedPhase
      )} phase.`;
      let announcementMsg = `:rotating_light: *Book Club Phase Change*\n\nThe "${cycle.getName()}" book club cycle has moved to the *${capitalizeFirstLetter(
        selectedPhase
      )} Phase*.`;

      if (
        selectedPhase === CyclePhase.SUGGESTION &&
        (currentPhase === CyclePhase.VOTING ||
          currentPhase === CyclePhase.READING ||
          currentPhase === CyclePhase.DISCUSSION)
      ) {
        // Clear the selected book
        updateData.selectedBookId = null;

        // Reset all votes for the cycle
        await Vote.resetVotesForCycle(cycle.getId());

        // Add warning to the confirmation message
        confirmationMsg += ` Any previously selected book has been cleared and all votes have been reset, but existing suggestions have been kept.`;

        // Add to announcement
        announcementMsg += `\n\nThis is a reset back to the suggestion phase. Any previously selected book has been cleared and all votes have been reset, but existing suggestions remain. Members can now suggest additional books using \`/chapters-suggest-book\`.`;
      }

      // Update the cycle
      const updatedCycle = await cycle.update(updateData);

      // Notify the phase transition service about the updated cycle
      phaseTransitionService.onCycleUpdated(updatedCycle);

      // Send confirmation to the user
      await respond({
        text: confirmationMsg,
        replace_original: true,
      });

      // Get phase duration for the announcement
      const phaseDurations = updatedCycle.getPhaseDurations();
      const duration =
        selectedPhase !== CyclePhase.PENDING
          ? phaseDurations[selectedPhase as keyof typeof phaseDurations]
          : undefined;
      const phaseDurationText = duration
        ? `\nThis phase will end in ${duration} days.`
        : "";

      // Add phase-specific instructions
      let phaseInstructions = "";
      if (selectedPhase === CyclePhase.SUGGESTION) {
        phaseInstructions = `\nUse \`/chapters-suggest-book\` to suggest books for this cycle.`;
      } else if (selectedPhase === CyclePhase.VOTING) {
        phaseInstructions = `\nUse \`/chapters-vote\` to cast your vote for your favorite books.`;
      } else if (selectedPhase === CyclePhase.READING) {
        if (selectedBookId) {
          const selectedBook = await Suggestion.getById(selectedBookId);
          if (selectedBook) {
            announcementMsg += `\n\nThe book selected for this cycle is *"${selectedBook.getBookName()}"* by *${selectedBook.getAuthor()}*.`;
          }
        }
      }

      announcementMsg += `${phaseInstructions}${phaseDurationText}`;

      // Post announcement in the channel
      await client.chat.postMessage({
        channel: channelId,
        text: announcementMsg,
      });
    })
  );

  // Handler for selecting book & changing phase in one action
  app.action(
    ActionId.SELECT_BOOK_AND_CHANGE_PHASE,
    withActionErrorHandling(async ({ body, client, action, respond }) => {
      const blockAction = body as BlockAction;
      const userId = blockAction.user.id;
      const channelId = blockAction.channel?.id;
      if (!userId || !channelId) throw new Error("Missing user or channel ID.");

      // Validate active cycle exists
      const cycle = await validateActiveCycleExists(channelId);

      // Get the data from the button value
      const buttonAction = action as any;
      const valueData = JSON.parse(buttonAction.value);
      const selectedPhase = valueData.phase as CyclePhase;
      const selectedBookId = new ObjectId(valueData.bookId);

      // Update the cycle with the selected book and new phase
      const updatedCycle = await cycle.update({
        currentPhase: selectedPhase,
        selectedBookId: selectedBookId,
      });

      // Notify the phase transition service about the updated cycle
      phaseTransitionService.onCycleUpdated(updatedCycle);

      // Get the selected book details
      const selectedBook = await Suggestion.getById(selectedBookId);

      if (!selectedBook) {
        throw new Error("Selected book not found. Please try again.");
      }

      // Post confirmation message to the user, replacing the current message
      await respond({
        text: `✅ The book club cycle has been moved to the ${capitalizeFirstLetter(
          selectedPhase
        )} phase with "${selectedBook.getBookName()}" by ${selectedBook.getAuthor()} selected as the book.`,
        replace_original: true,
      });

      // Post announcement in the channel (remains a new message)
      const phaseDurations = updatedCycle.getPhaseDurations();
      const duration =
        selectedPhase !== CyclePhase.PENDING
          ? phaseDurations[selectedPhase as keyof typeof phaseDurations]
          : undefined;
      const phaseDurationText = duration
        ? `\nThis phase will end in ${duration} days.`
        : "";

      await client.chat.postMessage({
        channel: channelId,
        text: `:rotating_light: *Book Club Phase Change*\n\nThe "${updatedCycle.getName()}" book club cycle has moved to the *${capitalizeFirstLetter(
          selectedPhase
        )} Phase* with *"${selectedBook.getBookName()}"* by *${selectedBook.getAuthor()}* selected as the book to read.${phaseDurationText}`,
      });
    })
  );

  // Handler for canceling phase change
  app.action(
    ActionId.CANCEL_PHASE_CHANGE,
    withActionErrorHandling(async ({ body, client, respond }) => {
      // ack() is called by the wrapper

      const blockAction = body as BlockAction;
      const userId = blockAction.user.id;
      const channelId = blockAction.channel?.id;

      if (!userId || !channelId) {
        console.warn("Cancel phase change action missing user or channel ID.");
        // Original message will time out or stay.
        return;
      }

      // Send an ephemeral message to confirm cancellation, replacing the original
      await respond({
        text: "Phase change canceled.",
        replace_original: true,
      });
    })
  );

  // Handler for confirming cycle reset
  app.action(
    ActionId.CONFIRM_CYCLE_RESET,
    withActionErrorHandling(async ({ body, client, respond }) => {
      // ack() is called by the wrapper

      const blockAction = body as BlockAction;
      const userId = blockAction.user.id;
      const channelId = blockAction.channel?.id;

      if (!userId || !channelId) {
        console.warn("Confirm cycle reset action missing user or channel ID.");
        // It's tricky to use respond() here if we don't have channel/user,
        // as the original message might not be clear.
        // For now, if this happens, the original message will just time out or stay.
        // A better solution might involve a generic error message via respond if possible.
        return;
      }

      try {
        // Get the active cycle
        const cycle = await validateActiveCycleExists(channelId);
        const cycleName = cycle.getName();
        const cycleId = cycle.getId();

        // Remove the cycle from phase transition service tracking
        phaseTransitionService.onCycleCompleted(channelId);

        // Get database connection
        const db = await connectToDatabase();

        // Delete any suggestions for this cycle
        await deleteSuggestionsByCycle(db, cycleId);

        // Delete any votes for this cycle
        await deleteVotesByCycle(db, cycleId);

        // Delete the cycle itself
        await deleteCycleById(db, cycleId);

        // Send a confirmation message to the user by replacing the original message
        await respond({
          text: `✅ Book club cycle "${cycleName}" has been completely reset. All data has been deleted.`,
          replace_original: true,
        });

        // Post announcement in the channel (this remains as a new message)
        await client.chat.postMessage({
          channel: channelId,
          text: `:recycle: *Book Club Cycle Reset*\n\nThe book club cycle "${cycleName}" has been reset and all data has been deleted.\n\nTo start a new book club cycle, use the \`/chapters-start-cycle\` command.`,
        });
      } catch (error) {
        console.error("Error resetting cycle:", error);
        // Try to respond with an error, replacing the original message
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        try {
          await respond({
            text: `❌ Error resetting book club cycle: ${errorMessage}`,
            replace_original: true,
          });
        } catch (respondError) {
          console.error(
            "Failed to send error response via respond:",
            respondError
          );
          // Fallback to posting a new ephemeral if respond fails
          await client.chat.postEphemeral({
            channel: channelId, // Ensure channelId is available here
            user: userId, // Ensure userId is available here
            text: `❌ Error resetting book club cycle: ${errorMessage}. Please try again.`,
          });
        }
      }
    })
  );

  // Handler for canceling cycle reset
  app.action(
    ActionId.CANCEL_CYCLE_RESET,
    withActionErrorHandling(async ({ body, respond }) => {
      // ack() is called by the wrapper

      const blockAction = body as BlockAction;
      const userId = blockAction.user.id;
      const channelId = blockAction.channel?.id;

      if (!userId || !channelId) {
        console.warn("Cancel cycle reset action missing user or channel ID.");
        // Similar to above, if this happens, the original message might just time out.
        return;
      }

      // Send a confirmation message to the user by replacing the original message
      await respond({
        text: "Cycle reset canceled. No changes were made.",
        replace_original: true,
      });
    })
  );

  app.action(
    ActionId.CANCEL_CYCLE_CONFIG,
    withActionErrorHandling(async ({ body, respond, client }) => {
      // ack() is called by the wrapper

      const blockAction = body as BlockAction;
      // Extract userId and channelId for potential logging or future use
      const userId = blockAction.user.id;
      const channelId = blockAction.channel?.id;

      if (!userId || !channelId) {
        console.warn(
          "Cancel cycle configuration action missing user or channel ID."
        );
        return;
      }

      try {
        // Get the active cycle
        const cycle = await validateActiveCycleExists(channelId);
        const cycleId = cycle.getId();
        const cycleName = cycle.getName(); // Get name for the message

        // Remove the cycle from phase transition service tracking
        // This is important because the cycle was registered when /chapters-start-cycle was called
        phaseTransitionService.onCycleCompleted(channelId);

        // Get database connection
        const db = await connectToDatabase();

        // Delete any suggestions for this cycle (though unlikely at this stage)
        await deleteSuggestionsByCycle(db, cycleId);

        // Delete any votes for this cycle (also unlikely)
        await deleteVotesByCycle(db, cycleId);

        // Delete the cycle itself
        await deleteCycleById(db, cycleId);

        await respond({
          text: `Cycle configuration canceled. The provisional cycle "${cycleName}" has been deleted. The form has been dismissed.`,
          replace_original: true,
        });
      } catch (error) {
        console.error(
          "Error canceling cycle configuration and deleting cycle:",
          error
        );
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        // Try to respond with an error, replacing the original message
        try {
          await respond({
            text: `❌ Error canceling cycle configuration: ${errorMessage}`,
            replace_original: true,
          });
        } catch (respondError) {
          console.error(
            "Failed to send error response via respond:",
            respondError
          );
          // Fallback to posting a new ephemeral if respond fails (client might be needed here if not available)
          if (client) {
            // Check if client is available from context
            await client.chat.postEphemeral({
              channel: channelId,
              user: userId,
              text: `❌ Error canceling cycle configuration: ${errorMessage}. The cycle may not have been deleted. Please try again or use the \`/chapters-reset-cycle\` command to start from scratch.`,
            });
          }
        }
      }
    })
  );
};
