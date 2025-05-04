import { App } from "@slack/bolt";
import { registerCycleCommands } from "./cycle/index";
import { registerUtilityCommands } from "./utility";
import { registerSuggestionCommands } from "./suggestion/index";

/**
 * Registers all commands
 * @param app - The Slack app
 */
export function registerCommands(app: App): void {
  registerUtilityCommands(app);
  registerCycleCommands(app);
  registerSuggestionCommands(app);
}
