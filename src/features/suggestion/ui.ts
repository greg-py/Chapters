import type { App, SlashCommand } from "@slack/bolt";
import { ActionId, BlockId } from "../../constants";
import type { Suggestion } from "../../services";

/**
 * Sends the book suggestion UI to the user
 * @param client - The Slack client
 * @param command - The original slash command
 */
export const sendBookSuggestionUI = async (
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
          text: "📚 Suggest a Book",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Add a book suggestion for the current book club cycle.",
        },
      },
      {
        type: "divider",
      },
      {
        type: "input",
        block_id: BlockId.BOOK_NAME,
        element: {
          type: "plain_text_input",
          action_id: ActionId.BOOK_NAME_INPUT,
          placeholder: {
            type: "plain_text",
            text: "Enter the book title",
          },
        },
        label: {
          type: "plain_text",
          text: "Book Title",
        },
      },
      {
        type: "input",
        block_id: BlockId.BOOK_AUTHOR,
        element: {
          type: "plain_text_input",
          action_id: ActionId.BOOK_AUTHOR_INPUT,
          placeholder: {
            type: "plain_text",
            text: "Enter the author's name",
          },
        },
        label: {
          type: "plain_text",
          text: "Author",
        },
      },
      {
        type: "input",
        block_id: BlockId.BOOK_URL,
        element: {
          type: "plain_text_input",
          action_id: ActionId.BOOK_URL_INPUT,
          placeholder: {
            type: "plain_text",
            text: "Add a link to the book (e.g., Goodreads, Amazon)",
          },
        },
        label: {
          type: "plain_text",
          text: "Link",
        },
      },
      {
        type: "input",
        block_id: BlockId.BOOK_NOTES,
        optional: true,
        element: {
          type: "plain_text_input",
          action_id: ActionId.BOOK_NOTES_INPUT,
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "Add a short description or reason for suggesting this book (optional)",
          },
        },
        label: {
          type: "plain_text",
          text: "Notes",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Submit Suggestion",
              emoji: true,
            },
            style: "primary",
            action_id: ActionId.SUBMIT_BOOK_SUGGESTION,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Cancel",
              emoji: true,
            },
            action_id: ActionId.CANCEL_BOOK_SUGGESTION,
          },
        ],
      },
    ],
    text: "Suggest a Book Form",
  });
};

/**
 * Sends the suggestions list UI to the channel
 * @param client - The Slack client
 * @param command - The original slash command
 * @param suggestions - The list of suggestions to display
 */
export const sendSuggestionsListUI = async (
  client: App["client"],
  command: SlashCommand,
  suggestions: Suggestion[]
): Promise<void> => {
  // Check if there are any suggestions
  if (suggestions.length === 0) {
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: "No book suggestions have been made for the current cycle yet.",
    });
    return;
  }

  // Create blocks for each suggestion
  const suggestionBlocks = suggestions.flatMap((suggestion, index) => {
    const blocks = [];

    // If not the first item, add a divider
    if (index > 0) {
      blocks.push({
        type: "divider",
      });
    }

    // Add the suggestion details
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${index + 1}. ${
          suggestion.getLink()
            ? `<${suggestion.getLink()}|${suggestion.getBookName()}>`
            : suggestion.getBookName()
        }*\nby ${suggestion.getAuthor()}`,
      },
    });

    // Add notes if they exist
    const notes = suggestion.getNotes();
    if (notes) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Notes:* ${notes}`,
        },
      });
    }

    // Add date information only (making suggestions anonymous)
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Added on ${formatDate(suggestion.getCreatedAt())}`,
        },
      ],
    });

    return blocks;
  });

  // Add header and send message
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📚 Book Suggestions",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `There are *${suggestions.length}* book suggestions for the current cycle.`,
      },
    },
    {
      type: "divider",
    },
    ...suggestionBlocks,
  ];

  await client.chat.postEphemeral({
    channel: command.channel_id,
    user: command.user_id,
    blocks,
    text: "Book Suggestions for Current Cycle",
  });
};

/**
 * Formats a date to a readable string
 * @param date - The date to format
 * @returns The formatted date string
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
