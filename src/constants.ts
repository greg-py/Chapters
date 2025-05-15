export enum CyclePhase {
  PENDING = "pending",
  SUGGESTION = "suggestion",
  VOTING = "voting",
  READING = "reading",
  DISCUSSION = "discussion",
}

// Action IDs used in Block Kit interactions
export const ActionId = {
  // Cycle Actions
  SUBMIT_CYCLE_CONFIG: "submit_cycle_config",
  CANCEL_CYCLE_CONFIG: "cancel_cycle_config",
  SELECT_PHASE: "select_phase",
  CONFIRM_PHASE_CHANGE: "confirm_phase_change",
  CANCEL_PHASE_CHANGE: "cancel_phase_change",
  SELECT_BOOK_AND_CHANGE_PHASE: "select_book_and_change_phase",
  CONFIRM_CYCLE_RESET: "confirm_cycle_reset",
  CANCEL_CYCLE_RESET: "cancel_cycle_reset",

  // Suggestion Actions
  SUBMIT_BOOK_SUGGESTION: "submit_book_suggestion",
  CANCEL_BOOK_SUGGESTION: "cancel_book_suggestion",
  FIRST_CHOICE_SELECT: "first_choice_select",
  SECOND_CHOICE_SELECT: "second_choice_select",
  THIRD_CHOICE_SELECT: "third_choice_select",
  SUBMIT_VOTE: "submit_vote",
  CANCEL_VOTE: "cancel_vote",

  // Input Action IDs (often nested within block IDs)
  CYCLE_NAME_INPUT: "cycle_name_input",
  SUGGESTION_DAYS_INPUT: "suggestion_days_input",
  VOTING_DAYS_INPUT: "voting_days_input",
  READING_DAYS_INPUT: "reading_days_input",
  DISCUSSION_DAYS_INPUT: "discussion_days_input",
  BOOK_NAME_INPUT: "book_name_input",
  BOOK_AUTHOR_INPUT: "book_author_input",
  BOOK_LINK_INPUT: "book_link_input",
  BOOK_URL_INPUT: "book_url_input",
  BOOK_NOTES_INPUT: "book_notes_input",
};

// Block IDs used in Block Kit interactions
export const BlockId = {
  // Cycle Config UI
  CYCLE_NAME: "cycle_name",
  SUGGESTION_DURATION: "suggestion_duration",
  VOTING_DURATION: "voting_duration",
  READING_DURATION: "reading_duration",
  DISCUSSION_DURATION: "discussion_duration",

  // Phase Selection UI
  PHASE_SELECTION: "phase_selection",

  // Suggestion UI
  BOOK_NAME: "book_name",
  BOOK_AUTHOR: "book_author",
  BOOK_LINK: "book_link",
  BOOK_URL: "book_url",
  BOOK_NOTES: "book_notes",

  // Voting UI
  FIRST_CHOICE: "first_choice",
  SECOND_CHOICE: "second_choice",
  THIRD_CHOICE: "third_choice",
};

/**
 * Slack API endpoint paths
 */
export const SlackEndpoints = {
  EVENTS: "/slack/events",
  COMMANDS: "/slack/commands",
  INTERACTIONS: "/slack/interactions",
};

/**
 * Slack API error codes
 */
export enum SlackErrorCode {
  RATE_LIMITED = "slack_webapi_platform_error",
  REQUEST_ERROR = "slack_webapi_request_error",
}

/**
 * API service constants
 */
export const API = {
  HEALTH_CHECK_PATH: "/",
  DEFAULT_PORT: 3000,
  SHUTDOWN_TIMEOUT_MS: 5000,
};

/**
 * Security related constants
 */
export const Security = {
  HEADERS: {
    CONTENT_TYPE_OPTIONS: "X-Content-Type-Options",
    FRAME_OPTIONS: "X-Frame-Options",
    XSS_PROTECTION: "X-XSS-Protection",
  },
  HEADER_VALUES: {
    NO_SNIFF: "nosniff",
    DENY_FRAMES: "DENY",
    BLOCK_XSS: "1; mode=block",
  },
};
