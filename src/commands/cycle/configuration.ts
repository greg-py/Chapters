import type { App, SlashCommand } from "@slack/bolt";
import type { Cycle } from "../../services";
import { capitalizeFirstLetter, formatDate } from "../../utils";

export const sendCycleConfigurationUI = async (
  cycle: Cycle,
  client: App["client"],
  command: SlashCommand
) => {
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
          text: "Before starting, let's configure the duration for each phase of the book club. You can customize these settings or use the defaults.",
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Cycle Name*\nGive this book club cycle a name:",
        },
      },
      {
        type: "input",
        block_id: "cycle_name",
        element: {
          type: "plain_text_input",
          action_id: "cycle_name_input",
          placeholder: {
            type: "plain_text",
            text: "Enter a name for this cycle",
          },
          initial_value: cycle.getName(),
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
          text: "*Suggestion Phase Duration*\nHow many days should members have to suggest books?",
        },
      },
      {
        type: "input",
        block_id: "suggestion_duration",
        element: {
          type: "plain_text_input",
          action_id: "suggestion_days",
          placeholder: {
            type: "plain_text",
            text: "Enter number of days",
          },
          initial_value: cycle.getPhaseDurations().suggestion.toString(),
        },
        label: {
          type: "plain_text",
          text: "Days",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Voting Phase Duration*\nHow many days should members have to vote on books?",
        },
      },
      {
        type: "input",
        block_id: "voting_duration",
        element: {
          type: "plain_text_input",
          action_id: "voting_days",
          placeholder: {
            type: "plain_text",
            text: "Enter number of days",
          },
          initial_value: cycle.getPhaseDurations().voting.toString(),
        },
        label: {
          type: "plain_text",
          text: "Days",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Reading Phase Duration*\nHow many days should members have to read the book?",
        },
      },
      {
        type: "input",
        block_id: "reading_duration",
        element: {
          type: "plain_text_input",
          action_id: "reading_days",
          placeholder: {
            type: "plain_text",
            text: "Enter number of days",
          },
          initial_value: cycle.getPhaseDurations().reading.toString(),
        },
        label: {
          type: "plain_text",
          text: "Days",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Discussion Phase Duration*\nHow many days should the book discussion last?",
        },
      },
      {
        type: "input",
        block_id: "discussion_duration",
        element: {
          type: "plain_text_input",
          action_id: "discussion_days",
          placeholder: {
            type: "plain_text",
            text: "Enter number of days",
          },
          initial_value: cycle.getPhaseDurations().discussion.toString(),
        },
        label: {
          type: "plain_text",
          text: "Days",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Save Configuration",
              emoji: true,
            },
            style: "primary",
            action_id: "submit_cycle_config",
          },
        ],
      },
    ],
  });
};

export const sendCycleStatusMessage = async (
  cycle: Cycle,
  client: App["client"],
  command: SlashCommand
) => {
  await client.chat.postEphemeral({
    channel: command.channel_id,
    user: command.user_id,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📚 Book Club Status 📚",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Current Cycle: *${cycle.getName()}*`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Current Phase: *${capitalizeFirstLetter(
            cycle.getCurrentPhase()
          )}*`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Current Phase Deadline: *${formatDate(
            cycle.getCurrentPhaseDeadline()
          )}*`,
        },
      },
    ],
  });
};

export const sendCyclePhaseSelectionUI = async (
  cycle: Cycle,
  client: App["client"],
  command: SlashCommand
) => {
  await client.chat.postEphemeral({
    channel: command.channel_id,
    user: command.user_id,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📚 Book Club Phase Selection 📚",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Current Cycle:* ${cycle.getName()}\n*Current Phase:* ${capitalizeFirstLetter(
            cycle.getCurrentPhase()
          )}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Select the phase you want to transition to:",
        },
      },
      {
        type: "actions",
        block_id: "phase_selection",
        elements: [
          {
            type: "static_select",
            action_id: "select_phase",
            placeholder: {
              type: "plain_text",
              text: "Choose a phase",
              emoji: true,
            },
            options: [
              {
                text: {
                  type: "plain_text",
                  text: "📝 Suggestion Phase",
                  emoji: true,
                },
                value: "suggestion",
              },
              {
                text: {
                  type: "plain_text",
                  text: "🗳️ Voting Phase",
                  emoji: true,
                },
                value: "voting",
              },
              {
                text: {
                  type: "plain_text",
                  text: "📖 Reading Phase",
                  emoji: true,
                },
                value: "reading",
              },
              {
                text: {
                  type: "plain_text",
                  text: "💬 Discussion Phase",
                  emoji: true,
                },
                value: "discussion",
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
            action_id: "confirm_phase_change",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Cancel",
              emoji: true,
            },
            action_id: "cancel_phase_change",
          },
        ],
      },
    ],
  });
};
