import type { App } from "@slack/bolt";
import type { BlockAction } from "@slack/bolt";
import { Suggestion, Cycle } from "../services";

export const registerSuggestionActions = (app: App) => {
  app.action("submit_book_suggestion", async ({ ack, body, client }) => {
    await ack();

    // Get values from state
    const blockAction = body as BlockAction;
    const userId = blockAction.user.id;
    const channelId = blockAction.channel?.id;
    const values = blockAction.state?.values;

    // If needed values are missing, prevent the action from being processed
    if (!userId || !channelId || !values) {
      throw new Error(
        "There was an error retrieving the configuration values. Please try again."
      );
    }

    // Extract individual values from the state
    const bookName = values.book_name.book_name_input.value;
    const bookAuthor = values.book_author.book_author_input.value;
    const bookLink = values.book_link.book_link_input.value;
    const bookNotes = values.book_notes.book_notes_input.value;

    // Validate inputs
    if (!bookName) {
      throw new Error("Please enter a valid book name.");
    }

    if (!bookAuthor) {
      throw new Error("Please enter a valid book author.");
    }

    if (!bookLink) {
      throw new Error("Please enter a valid book link.");
    }

    // Get the active cycle
    const cycle = await Cycle.getActive(channelId);

    if (!cycle) {
      throw new Error("No active cycle found for this channel.");
    }

    // Create a new suggestion
    const suggestion = await Suggestion.createNew(
      cycle.getId(),
      userId,
      bookName,
      bookAuthor,
      bookLink,
      bookNotes || undefined
    );

    // Post a private success message to the user
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: "Book suggestion submitted successfully!",
    });

    // Announce the new suggestion publicly
    await client.chat.postMessage({
      channel: channelId,
      text: "📚 New Book Suggestion: 📚",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "📚 New Book Suggestion: 📚",
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Author:* ${suggestion.getAuthor()}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Book Name:* ${suggestion.getBookName()}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Notes:* ${suggestion.getNotes()}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<${suggestion.getLink()}|View book>`,
          },
        },
      ],
    });
  });
};
