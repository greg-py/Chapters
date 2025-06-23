import type { App, SlashCommand } from "@slack/bolt";
import type { Suggestion } from "../../services";
import { ActionId, BlockId } from "../../constants";

/**
 * Sends the rating UI to the user
 * @param client - The Slack client
 * @param command - The original slash command
 * @param selectedBook - The book being rated
 */
export const sendRatingUI = async (
  client: App["client"],
  command: SlashCommand,
  selectedBook: Suggestion
): Promise<void> => {
  // Create rating options (1-10)
  const ratingOptions = [];
  for (let i = 1; i <= 10; i++) {
    ratingOptions.push({
      text: {
        type: "plain_text" as const,
        text: `${i}/10`,
        emoji: true,
      },
      value: i.toString(),
    });
  }

  await client.chat.postEphemeral({
    channel: command.channel_id,
    user: command.user_id,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "⭐ Rate the Book",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Please rate *"${selectedBook.getBookName()}"* by *${selectedBook.getAuthor()}* and let us know if you would recommend it to others.`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*How would you rate this book?*",
        },
      },
      {
        type: "actions",
        block_id: BlockId.BOOK_RATING,
        elements: [
          {
            type: "static_select" as const,
            action_id: ActionId.RATING_SELECT,
            placeholder: {
              type: "plain_text" as const,
              text: "Select a rating (1-10)",
              emoji: true,
            },
            options: ratingOptions,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Would you recommend this book to others?*",
        },
      },
      {
        type: "actions",
        block_id: BlockId.BOOK_RECOMMEND,
        elements: [
          {
            type: "static_select" as const,
            action_id: ActionId.RECOMMEND_SELECT,
            placeholder: {
              type: "plain_text" as const,
              text: "Select recommendation",
              emoji: true,
            },
            options: [
              {
                text: {
                  type: "plain_text" as const,
                  text: "👍 Yes, I would recommend it",
                  emoji: true,
                },
                value: "yes",
              },
              {
                text: {
                  type: "plain_text" as const,
                  text: "👎 No, I would not recommend it",
                  emoji: true,
                },
                value: "no",
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
            text: "Your rating will help other members decide on future book selections.",
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
              text: "Submit Rating",
              emoji: true,
            },
            style: "primary",
            action_id: ActionId.SUBMIT_RATING,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Cancel",
              emoji: true,
            },
            action_id: ActionId.CANCEL_RATING,
          },
        ],
      },
    ],
    text: "Rate Book Form",
  });
};

/**
 * Sends the rating results UI to the user
 * @param client - The Slack client
 * @param command - The original slash command
 * @param selectedBook - The book that was rated
 * @param stats - The rating statistics
 */
export const sendRatingResultsUI = async (
  client: App["client"],
  command: SlashCommand,
  selectedBook: Suggestion,
  stats: {
    averageRating: number;
    recommendationPercentage: number;
    totalRatings: number;
  }
): Promise<void> => {
  // Generate star display for average rating
  const fullStars = Math.floor(stats.averageRating);
  const hasHalfStar = stats.averageRating % 1 >= 0.5;
  const starDisplay = "⭐".repeat(fullStars) + (hasHalfStar ? "✨" : "");

  // Create link to the book if URL is available
  const bookLink = selectedBook.getLink()
    ? `<${selectedBook.getLink()}|${selectedBook.getBookName()}>`
    : selectedBook.getBookName();

  await client.chat.postEphemeral({
    channel: command.channel_id,
    user: command.user_id,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📊 Book Rating Results",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Book:* ${bookLink}\n*Author:* ${selectedBook.getAuthor()}`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Average Rating:*\n${starDisplay} ${stats.averageRating}/10`,
          },
          {
            type: "mrkdwn",
            text: `*Recommendation:*\n${stats.recommendationPercentage}% would recommend`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Total Ratings:* ${stats.totalRatings} member${
            stats.totalRatings === 1 ? "" : "s"
          } have rated this book`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text:
              stats.totalRatings === 0
                ? "No ratings yet. Use `/chapters-rate-book` to be the first to rate this book!"
                : "Use `/chapters-rate-book` to add your rating if you haven't already.",
          },
        ],
      },
    ],
    text: "Book Rating Results",
  });
};
