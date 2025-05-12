import { App } from "@slack/bolt";
import { registerVoteCommands } from "./commands";
import { registerVoteActions } from "./actions";

/**
 * Registers all vote feature components (commands and actions)
 * @param app - The Slack app
 */
export function registerVoteFeature(app: App): void {
  registerVoteCommands(app);
  registerVoteActions(app);
}
