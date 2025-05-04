import { SlashCommand } from "@slack/bolt";
import { App } from "@slack/bolt";
import { Suggestion } from "../../services";

/**
 * Sends a book suggestion UI to the channel
 * @param client - The Slack client
 * @param command - The slash command
 */
export const sendBookSuggestionUI = async (
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
          text: "📚 Book Club Suggestion",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Please enter the details of the book you would like to suggest.",
        },
      },
      {
        type: "divider",
      },
      {
        type: "input",
        block_id: "book_name",
        element: {
          type: "plain_text_input",
          action_id: "book_name_input",
          placeholder: {
            type: "plain_text",
            text: "Enter the name of the book",
          },
          initial_value: "",
        },
        label: {
          type: "plain_text",
          text: "Book Name",
        },
      },
      {
        type: "input",
        block_id: "book_author",
        element: {
          type: "plain_text_input",
          action_id: "book_author_input",
          placeholder: {
            type: "plain_text",
            text: "Enter the author of the book",
          },
          initial_value: "",
        },
        label: {
          type: "plain_text",
          text: "Book Author",
        },
      },
      {
        type: "input",
        block_id: "book_link",
        element: {
          type: "plain_text_input",
          action_id: "book_link_input",
          placeholder: {
            type: "plain_text",
            text: "Enter the link to the book",
          },
          initial_value: "",
        },
        label: {
          type: "plain_text",
          text: "Book Link",
        },
      },
      {
        type: "input",
        block_id: "book_notes",
        element: {
          type: "plain_text_input",
          action_id: "book_notes_input",
          placeholder: {
            type: "plain_text",
            text: "Enter the notes for the book",
          },
          initial_value: "",
        },
        label: {
          type: "plain_text",
          text: "Book Notes (optional)",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Submit",
              emoji: true,
            },
            style: "primary",
            action_id: "submit_book_suggestion",
          },
        ],
      },
    ],
  });
};

/**
 * Sends a list of book suggestions to the channel
 * @param client - The Slack client
 * @param command - The slash command
 * @param suggestions - The list of suggestions to send
 */
export const sendSuggestionsListUI = async (
  client: App["client"],
  command: SlashCommand,
  suggestions: Suggestion[]
) => {
  const suggestionsList = suggestions
    .map((suggestion) => {
      const displayData = suggestion.formatForDisplay();
      return (
        `*${displayData.bookName}* by ${displayData.author}\n` +
        `• Link: ${displayData.link}\n` +
        `• Notes: ${displayData.notes}\n`
      );
    })
    .join("\n\n");

  await client.chat.postEphemeral({
    channel: command.channel_id,
    user: command.user_id,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📚 Book Club Suggestions",
          emoji: true,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Here are the current book suggestions:",
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            suggestionsList || "No suggestions found for the current cycle.",
        },
      },
    ],
  });
};
