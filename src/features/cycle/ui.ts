import type { App, SlashCommand } from "@slack/bolt";
import type { Cycle } from "../../services";
import { Suggestion } from "../../services";
import { capitalizeFirstLetter, formatDate } from "../../utils";
import { ActionId, BlockId, CyclePhase } from "../../constants";
import { getPhaseConfig } from "../../config";

/**
 * Sends the cycle configuration UI to the user
 * @param cycle - The cycle being configured
 * @param client - The Slack client
 * @param command - The original slash command
 */
export const sendCycleConfigurationUI = async (
  cycle: Cycle,
  client: App["client"],
  command: SlashCommand
): Promise<void> => {
  await client.chat.postEphemeral({
    channel: command.channel_id,
    user: command.user_id,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📚 Book Club Configuration",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Configure the details for your new book club cycle. Default durations are provided.",
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Cycle Name*",
        },
      },
      {
        type: "input",
        block_id: BlockId.CYCLE_NAME,
        element: {
          type: "plain_text_input",
          action_id: ActionId.CYCLE_NAME_INPUT,
          placeholder: {
            type: "plain_text",
            text: "Enter a name for this cycle (e.g., Q3 Reads)",
          },
          initial_value: cycle.getName(), // Assuming default name is set in createNew
        },
        label: {
          type: "plain_text",
          text: "Name",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Phase Durations (in days)*",
        },
      },
      {
        type: "input",
        block_id: BlockId.SUGGESTION_DURATION,
        element: {
          type: "plain_text_input",
          action_id: ActionId.SUGGESTION_DAYS_INPUT,
          initial_value:
            process.env.PHASE_TEST_MODE === "true"
              ? "1 min"
              : getPhaseConfig().suggestion.toString(),
          placeholder: { type: "plain_text", text: "Days" },
        },
        label: { type: "plain_text", text: "Suggestion Phase Duration" },
      },
      {
        type: "input",
        block_id: BlockId.VOTING_DURATION,
        element: {
          type: "plain_text_input",
          action_id: ActionId.VOTING_DAYS_INPUT,
          initial_value:
            process.env.PHASE_TEST_MODE === "true"
              ? "1 min"
              : getPhaseConfig().voting.toString(),
          placeholder: { type: "plain_text", text: "Days" },
        },
        label: { type: "plain_text", text: "Voting Phase Duration" },
      },
      {
        type: "input",
        block_id: BlockId.READING_DURATION,
        element: {
          type: "plain_text_input",
          action_id: ActionId.READING_DAYS_INPUT,
          initial_value:
            process.env.PHASE_TEST_MODE === "true"
              ? "1 min"
              : getPhaseConfig().reading.toString(),
          placeholder: { type: "plain_text", text: "Days" },
        },
        label: { type: "plain_text", text: "Reading Phase Duration" },
      },
      {
        type: "input",
        block_id: BlockId.DISCUSSION_DURATION,
        element: {
          type: "plain_text_input",
          action_id: ActionId.DISCUSSION_DAYS_INPUT,
          initial_value:
            process.env.PHASE_TEST_MODE === "true"
              ? "1 min"
              : getPhaseConfig().discussion.toString(),
          placeholder: { type: "plain_text", text: "Days" },
        },
        label: { type: "plain_text", text: "Discussion Phase Duration" },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Save Configuration & Start",
              emoji: true,
            },
            style: "primary",
            action_id: ActionId.SUBMIT_CYCLE_CONFIG,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Cancel",
              emoji: true,
            },
            action_id: ActionId.CANCEL_CYCLE_CONFIG,
          },
        ],
      },
    ],
    text: "Book Club Configuration Form",
  });
};

/**
 * Sends the cycle status message to the user
 * @param cycle - The current cycle
 * @param client - The Slack client
 * @param command - The original slash command
 */
export const sendCycleStatusMessage = async (
  cycle: Cycle,
  client: App["client"],
  command: SlashCommand
): Promise<void> => {
  const stats = await cycle.getStats(); // Fetch stats once
  const currentPhase = cycle.getCurrentPhase();
  const deadline = cycle.getCurrentPhaseDeadline();

  // Get appropriate emoji for current phase
  let phaseEmoji = "📝";
  switch (currentPhase) {
    case CyclePhase.SUGGESTION:
      phaseEmoji = "📝";
      break;
    case CyclePhase.VOTING:
      phaseEmoji = "🗳️";
      break;
    case CyclePhase.READING:
      phaseEmoji = "📖";
      break;
    case CyclePhase.DISCUSSION:
      phaseEmoji = "💬";
      break;
    default:
      phaseEmoji = "📝";
  }

  // Build blocks array
  const blocks: any = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📚 Book Club Cycle Status",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Cycle Name:* ${cycle.getName()}`,
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${phaseEmoji} *Current Phase:* ${capitalizeFirstLetter(
          currentPhase
        )}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⏱️ *Phase Deadline:* ${
          deadline ? formatDate(deadline) : "Not set"
        }`,
      },
    },
  ];

  // Add selected book info if available
  const selectedBookId = cycle.getSelectedBookId();
  if (selectedBookId) {
    const selectedBook = await Suggestion.getById(selectedBookId);
    if (selectedBook) {
      blocks.push({
        type: "divider",
      });

      // Create link to the book if URL is available
      const bookLink = selectedBook.getLink()
        ? `<${selectedBook.getLink()}|${selectedBook.getBookName()}>`
        : selectedBook.getBookName();

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📖 *Current Book:* ${bookLink} by ${selectedBook.getAuthor()}`,
        },
      });
    }
  }

  blocks.push(
    {
      type: "divider",
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `📚 *Book Suggestions:* ${stats.totalSuggestions}`,
        },
        {
          type: "mrkdwn",
          text: `📊 *Votes Cast:* ${stats.totalVotes}`,
        },
      ] as any, // Type assertion to avoid TypeScript error with fields property
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Use \`/chapters-set-phase\` to manually change the current phase.`,
        },
      ],
    }
  );

  await client.chat.postEphemeral({
    channel: command.channel_id,
    user: command.user_id,
    blocks,
    text: "Book Club Cycle Status",
  });
};

/**
 * Sends the cycle phase selection UI to the user
 * @param cycle - The current cycle
 * @param client - The Slack client
 * @param command - The original slash command
 */
export const sendCyclePhaseSelectionUI = async (
  cycle: Cycle,
  client: App["client"],
  command: SlashCommand
): Promise<void> => {
  await client.chat.postEphemeral({
    channel: command.channel_id,
    user: command.user_id,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "⚙️ Change Book Club Phase",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Select the next phase for the *${cycle.getName()}* cycle. The current phase is *${capitalizeFirstLetter(
            cycle.getCurrentPhase()
          )}*.`,
        },
      },
      {
        type: "actions",
        block_id: BlockId.PHASE_SELECTION,
        elements: [
          {
            type: "static_select",
            action_id: ActionId.SELECT_PHASE,
            placeholder: {
              type: "plain_text",
              text: "Choose a phase",
              emoji: true,
            },
            options: [
              {
                text: {
                  type: "plain_text",
                  text: `📝 ${capitalizeFirstLetter(
                    CyclePhase.SUGGESTION
                  )} Phase`,
                  emoji: true,
                },
                value: CyclePhase.SUGGESTION,
              },
              {
                text: {
                  type: "plain_text",
                  text: `🗳️ ${capitalizeFirstLetter(CyclePhase.VOTING)} Phase`,
                  emoji: true,
                },
                value: CyclePhase.VOTING,
              },
              {
                text: {
                  type: "plain_text",
                  text: `📖 ${capitalizeFirstLetter(CyclePhase.READING)} Phase`,
                  emoji: true,
                },
                value: CyclePhase.READING,
              },
              {
                text: {
                  type: "plain_text",
                  text: `💬 ${capitalizeFirstLetter(
                    CyclePhase.DISCUSSION
                  )} Phase`,
                  emoji: true,
                },
                value: CyclePhase.DISCUSSION,
              },
            ],
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Changing the phase will update the current cycle and notify the channel. This action cannot be undone.",
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Confirm Phase Change",
              emoji: true,
            },
            style: "primary",
            action_id: ActionId.CONFIRM_PHASE_CHANGE,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Cancel",
              emoji: true,
            },
            action_id: ActionId.CANCEL_PHASE_CHANGE,
          },
        ],
      },
    ],
    text: "Change Book Club Phase Form",
  });
};
