import { App } from "@slack/bolt";
import { registerCycleFeature } from "./cycle";
import { registerSuggestionFeature } from "./suggestion";
import { registerVoteFeature } from "./vote";
import { registerUtilityFeature } from "./utility";

/**
 * Registers all features (commands and actions)
 * @param app - The Slack app
 */
export function registerFeatures(app: App): void {
  registerUtilityFeature(app);
  registerCycleFeature(app);
  registerSuggestionFeature(app);
  registerVoteFeature(app);
}
