import { App } from "@slack/bolt";
import { registerDiscussionCommands } from "./commands";
import { registerDiscussionActions } from "./actions";

/**
 * Registers all discussion feature components (commands and actions)
 * @param app - The Slack app
 */
export function registerDiscussionFeature(app: App): void {
  registerDiscussionCommands(app);
  registerDiscussionActions(app);
}
