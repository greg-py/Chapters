import type { App, BlockAction } from "@slack/bolt";
import { Cycle } from "../services";
import { capitalizeFirstLetter } from "../utils";
import type { TCyclePhase } from "../models";

export const registerCycleActions = (app: App) => {
  app.action("submit_cycle_config", async ({ body, ack, client }) => {
    await ack();

    // Get values from state
    const blockAction = body as BlockAction;
    const userId = blockAction.user.id;
    const channelId = blockAction.channel?.id;
    const values = blockAction.state?.values;

    // If needed values are missing, prevent the action from being processed
    if (!userId || !channelId || !values) {
      throw new Error(
        "There was an error retrieving the configuration values. Please try again."
      );
    }

    // Extract individual values from the state
    const cycleName = values.cycle_name.cycle_name_input.value;
    const suggestionPhaseDuration = parseInt(
      values.suggestion_duration.suggestion_days.value || "0",
      10
    );
    const votingPhaseDuration = parseInt(
      values.voting_duration.voting_days.value || "0",
      10
    );
    const readingPhaseDuration = parseInt(
      values.reading_duration.reading_days.value || "0",
      10
    );
    const discussionPhaseDuration = parseInt(
      values.discussion_duration.discussion_days.value || "0",
      10
    );

    // Validate inputs
    if (!cycleName) {
      throw new Error("Please enter a valid cycle name.");
    }

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
        "All durations must be positive numbers. Please try again."
      );
    }

    // Save updated cycle configuration and start the suggestion phase
    const cycle = await Cycle.getActive(channelId);
    if (!cycle) {
      throw new Error(
        "No active cycle found for this channel. Please create a new cycle using `/chapters-start-cycle`."
      );
    }

    const updatedCycle = await cycle.update({
      name: cycleName,
      phaseDurations: {
        suggestion: suggestionPhaseDuration,
        voting: votingPhaseDuration,
        reading: readingPhaseDuration,
        discussion: discussionPhaseDuration,
      },
      currentPhase: "suggestion",
    });

    // Post confirmation message to user
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: `Book club cycle "${updatedCycle.getName()}" configured successfully and moved to the suggestion phase! Members can now suggest books using the \`/chapters-suggest-book\` command.`,
    });

    // Post announcement in the channel
    await client.chat.postMessage({
      channel: channelId,
      text: `:books: *Book Club Cycle Started!*\n\nA new book club cycle "${updatedCycle.getName()}" has been started in this channel.\n\nWe are now in the *Suggestion Phase*. Use \`/chapters-suggest-book\` to suggest books for this cycle.\n\nThe suggestion phase will end in ${suggestionPhaseDuration} days.`,
    });
  });

  // Handler for phase selection
  app.action("select_phase", async ({ ack }) => {
    // Just acknowledge the action, we'll handle the actual phase change when the confirm button is clicked
    await ack();
  });

  // Handler for confirming phase change
  app.action("confirm_phase_change", async ({ body, ack, client }) => {
    await ack();

    const blockAction = body as BlockAction;
    const userId = blockAction.user.id;
    const channelId = blockAction.channel?.id;
    const values = blockAction.state?.values;

    if (!userId || !channelId || !values) {
      throw new Error(
        "There was an error retrieving the phase selection. Please try again."
      );
    }

    // Get the selected phase from the dropdown
    const selectedPhase =
      values.phase_selection.select_phase.selected_option?.value;

    if (!selectedPhase) {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: "Please select a phase before confirming.",
      });
      return;
    }

    // Get the active cycle
    const cycle = await Cycle.getActive(channelId);

    if (!cycle) {
      throw new Error("No active cycle found for this channel.");
    }

    // Update the cycle with the new phase
    const updatedCycle = await cycle.update({
      currentPhase: selectedPhase as TCyclePhase,
    });

    // Post confirmation message to the user
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: `The book club cycle has been moved to the ${capitalizeFirstLetter(
        selectedPhase
      )} phase.`,
    });

    // Post announcement in the channel
    const phaseDurations = updatedCycle.getPhaseDurations();
    // Handle special case for 'pending' phase which doesn't have a duration
    let phaseDuration = 0;
    if (selectedPhase !== "pending") {
      phaseDuration =
        phaseDurations[selectedPhase as Exclude<TCyclePhase, "pending">];
    }

    await client.chat.postMessage({
      channel: channelId,
      text: `:rotating_light: *Book Club Phase Change*\n\nThe "${updatedCycle.getName()}" book club cycle has moved to the *${capitalizeFirstLetter(
        selectedPhase
      )} Phase*.\n\nThis phase will end in ${phaseDuration} days.`,
    });
  });

  // Handler for canceling phase change
  app.action("cancel_phase_change", async ({ body, ack, client }) => {
    await ack();

    const blockAction = body as BlockAction;
    const userId = blockAction.user.id;
    const channelId = blockAction.channel?.id;

    if (!userId || !channelId) {
      return;
    }

    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: "Phase change canceled.",
    });
  });
};
