import type { App, SlashCommand } from "@slack/bolt";
import { ActionId, BlockId } from "../../constants";
import type { Suggestion } from "../../services";

/**
 * Sends the voting UI to the user
 * @param client - The Slack client
 * @param command - The original slash command
 * @param suggestions - The list of suggestions to vote on
 */
export const sendVoteUI = async (
  client: App["client"],
  command: SlashCommand,
  suggestions: Suggestion[]
): Promise<void> => {
  // Check if there are enough suggestions to vote on
  if (suggestions.length < 2) {
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: "There aren't enough book suggestions to vote on yet. At least 2 suggestions are required.",
    });
    return;
  }

  // Create options for each suggestion
  const suggestionOptions = suggestions.map((suggestion) => ({
    text: {
      type: "plain_text" as const,
      text: `${suggestion.getBookName()} by ${suggestion.getAuthor()}`.substring(
        0,
        75
      ), // Slack limits option text length
      emoji: true,
    },
    value: suggestion.getId().toString(),
  }));

  await client.chat.postEphemeral({
    channel: command.channel_id,
    user: command.user_id,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🗳️ Vote for Books",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Please select your top 3 choices in order of preference. You can view the full list of suggestions with `/chapters-view-suggestions`.",
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*First Choice*",
        },
      },
      {
        type: "actions",
        block_id: BlockId.FIRST_CHOICE,
        elements: [
          {
            type: "static_select" as const,
            action_id: ActionId.FIRST_CHOICE_SELECT,
            placeholder: {
              type: "plain_text" as const,
              text: "Select your first choice",
              emoji: true,
            },
            options: suggestionOptions,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Second Choice*",
        },
      },
      {
        type: "actions",
        block_id: BlockId.SECOND_CHOICE,
        elements: [
          {
            type: "static_select" as const,
            action_id: ActionId.SECOND_CHOICE_SELECT,
            placeholder: {
              type: "plain_text" as const,
              text: "Select your second choice",
              emoji: true,
            },
            options: suggestionOptions,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Third Choice*",
        },
      },
      {
        type: "actions",
        block_id: BlockId.THIRD_CHOICE,
        elements: [
          {
            type: "static_select" as const,
            action_id: ActionId.THIRD_CHOICE_SELECT,
            placeholder: {
              type: "plain_text" as const,
              text: "Select your third choice",
              emoji: true,
            },
            options: suggestionOptions,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "All votes are final. Please select different books for each choice.",
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
              text: "Submit Vote",
              emoji: true,
            },
            style: "primary",
            action_id: ActionId.SUBMIT_VOTE,
          },
        ],
      },
    ],
  });
};

/**
 * Sends the voting results UI to the channel
 * @param client - The Slack client
 * @param command - The original slash command
 * @param suggestions - The list of suggestions with vote counts
 */
export const sendVotingResultsUI = async (
  client: App["client"],
  command: SlashCommand,
  suggestions: Suggestion[]
): Promise<void> => {
  // Check if there are any suggestions with votes
  if (suggestions.length === 0) {
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: "There are no book suggestions with votes for the current cycle.",
    });
    return;
  }

  // Sort suggestions by weighted vote count (if available)
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const aVotes = a.getTotalPoints() || 0;
    const bVotes = b.getTotalPoints() || 0;
    return bVotes - aVotes;
  });

  // Create blocks for each suggestion
  const resultBlocks = sortedSuggestions.flatMap((suggestion, index) => {
    const blocks = [];

    // If not the first item, add a divider
    if (index > 0) {
      blocks.push({
        type: "divider",
      });
    }

    // Add the suggestion details with vote count
    const voteCount = suggestion.getTotalPoints() || 0;
    const medal =
      index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${medal} *${
          index + 1
        }. ${suggestion.getBookName()}*\nby ${suggestion.getAuthor()}\n*Votes: ${voteCount}*`,
      },
    });

    return blocks;
  });

  // Add header and send message
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🗳️ Voting Results",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Here are the current voting results for the ${suggestions.length} book suggestions, ranked by vote count.`,
      },
    },
    {
      type: "divider",
    },
    ...resultBlocks,
  ];

  await client.chat.postMessage({
    channel: command.channel_id,
    blocks,
  });
};

export const sendVoteConfirmationMessage = async (
  client: App["client"],
  channelId: string,
  userId: string,
  selections: {
    firstChoice?: string;
    secondChoice?: string;
    thirdChoice?: string;
  }
): Promise<void> => {
  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: "✅ Your vote has been recorded successfully! Thank you for participating.",
  });
};
