import { App } from "@slack/bolt";
import { registerCycleActions } from "./cycle";
import { registerSuggestionActions } from "./suggestion";

export const registerActions = (app: App) => {
  registerCycleActions(app);
  registerSuggestionActions(app);
};
