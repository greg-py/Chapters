import { App } from "@slack/bolt";
import { registerCycleCommands } from "./commands";
import { registerCycleActions } from "./actions";
import { phaseTransitionService } from "../../index";

/**
 * Registers all cycle feature components (commands and actions)
 * @param app - The Slack app
 */
export function registerCycleFeature(app: App): void {
  registerCycleCommands(app);
  registerCycleActions(app);
}
