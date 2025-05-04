import type { App } from "@slack/bolt";
import { Cycle } from "../../services";
import {
  sendCycleConfigurationUI,
  sendCyclePhaseSelectionUI,
  sendCycleStatusMessage,
} from "./configuration";
import { withErrorHandling } from "../../utils/errors";

/**
 * Registers all cycle commands
 * @param app - The Slack app
 */
export function registerCycleCommands(app: App) {
  // Command to open phase configuration UI to start a new book club cycle
  app.command(
    "/chapters-start-cycle",
    withErrorHandling(async ({ command, ack, client }) => {
      await ack();

      // Initializes the cycle by creating a new instance in the database with default values
      const cycle = await Cycle.createNew(command.channel_id);

      // Prompt user for custom cycle configuration values
      await sendCycleConfigurationUI(cycle, client, command);
    })
  );

  // Command to retrieve current active cycle information
  app.command(
    "/chapters-cycle-status",
    withErrorHandling(async ({ command, ack, client }) => {
      await ack();

      const cycle = await Cycle.getActive(command.channel_id);

      if (!cycle) {
        throw new Error(
          "No active cycle found for this channel. Use `/chapters-start-cycle` to create a new cycle."
        );
      }

      await sendCycleStatusMessage(cycle, client, command);
    })
  );

  // Command to change the phase of the current cycle
  app.command(
    "/chapters-set-phase",
    withErrorHandling(async ({ command, ack, client }) => {
      await ack();

      const cycle = await Cycle.getActive(command.channel_id);

      if (!cycle) {
        throw new Error(
          "No active cycle found for this channel. Use `/chapters-start-cycle` to create a new cycle."
        );
      }

      await sendCyclePhaseSelectionUI(cycle, client, command);
    })
  );
}
