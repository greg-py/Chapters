import { App } from "@slack/bolt";
import { registerUtilityCommands } from "./commands";

/**
 * Registers all utility feature components (commands)
 * @param app - The Slack app
 */
export function registerUtilityFeature(app: App): void {
  registerUtilityCommands(app);
}
