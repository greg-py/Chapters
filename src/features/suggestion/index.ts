import { App } from "@slack/bolt";
import { registerSuggestionCommands } from "./commands";
import { registerSuggestionActions } from "./actions";

/**
 * Registers all suggestion feature components (commands and actions)
 * @param app - The Slack app
 */
export function registerSuggestionFeature(app: App): void {
  registerSuggestionCommands(app);
  registerSuggestionActions(app);
}
