import { App } from "@slack/bolt";
import { ClubSettingsRepository } from "../repositories/clubSettingsRepository";
import { BookSuggestionRepository } from "../repositories/bookSuggestionRepository";
import { VoteRepository } from "../repositories/voteRepository";
import { CycleRepository } from "../repositories/cycleRepository";
import { formatDate } from "../utils/dates";

export class PhaseManager {
  private app: App;
  private settingsRepo: ClubSettingsRepository;
  private suggestionRepo: BookSuggestionRepository;
  private voteRepo: VoteRepository;
  private cycleRepo: CycleRepository;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(app: App) {
    this.app = app;
    this.settingsRepo = new ClubSettingsRepository();
    this.suggestionRepo = new BookSuggestionRepository();
    this.voteRepo = new VoteRepository();
    this.cycleRepo = new CycleRepository();
  }

  // Start checking for phase transitions
  public startChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Check every hour
    this.checkInterval = setInterval(() => {
      this.checkPhaseTransitions().catch((error) => {
        console.error("Error in phase transition check:", error);
      });
    }, 60 * 60 * 1000); // Check every hour

    // Also check immediately
    this.checkPhaseTransitions().catch((error) => {
      console.error("Error in initial phase transition check:", error);
    });
  }

  // Stop checking for phase transitions
  public stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Check and handle phase transitions
  private async checkPhaseTransitions(): Promise<void> {
    console.log("Checking for phase transitions...");

    const settings = await this.settingsRepo.getAllSettingsForAllChannels();

    const now = new Date();

    for (const setting of settings) {
      // Skip inactive channels
      if (setting.currentPhase === "inactive") {
        continue;
      }

      // Skip channels without a current cycle
      if (!setting.currentCycleId) {
        continue;
      }

      // Get the current cycle to access its phase durations
      const currentCycle = await this.cycleRepo.getCycleById(
        setting.currentCycleId
      );
      if (!currentCycle) {
        console.error(
          `Cycle with ID ${setting.currentCycleId} not found for channel ${setting.channelId}`
        );
        continue;
      }

      // Use cycle-specific phase durations, or fall back to defaults
      const phaseDurations = currentCycle.phaseDurations || {
        suggestion: 7,
        voting: 7,
        reading: 30,
        discussion: 7,
      };

      // Handle suggestion phase deadlines
      if (
        setting.currentPhase === "suggestion" &&
        setting.suggestionDeadline &&
        now > setting.suggestionDeadline
      ) {
        // Check if there are enough book suggestions for voting
        const suggestions = await this.suggestionRepo.getAllSuggestions();

        if (suggestions.length < 3) {
          // Not enough suggestions, extend the suggestion phase by the configured suggestion days
          const extendedDeadline = new Date();
          extendedDeadline.setDate(
            extendedDeadline.getDate() + phaseDurations.suggestion
          );

          await this.settingsRepo.updatePhase(
            setting.channelId,
            "suggestion",
            extendedDeadline
          );

          // Notify the channel
          try {
            await this.app.client.chat.postMessage({
              channel: setting.channelId,
              text: "📚 Suggestion phase extended! 📚",
              blocks: [
                {
                  type: "header",
                  text: {
                    type: "plain_text",
                    text: "📚 Book Suggestion Phase Extended! 📚",
                    emoji: true,
                  },
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `We need at least 3 book suggestions for ranked-choice voting to work properly. Currently there are only ${
                      suggestions.length
                    }. The suggestion phase has been extended until *${formatDate(
                      extendedDeadline
                    )}*!`,
                  },
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: "Use `/chapters-suggest [title] by [author] | url: [url] | notes: [notes]` to suggest more books.",
                  },
                },
              ],
            });
            console.log(
              `Extended suggestion phase for channel ${setting.channelId} due to insufficient book suggestions`
            );
          } catch (error) {
            console.error(
              `Error sending phase extension message to channel ${setting.channelId}:`,
              error
            );
          }

          continue; // Skip to next channel
        }

        // Transition to voting phase using cycle's voting duration
        const votingDeadline = new Date();
        votingDeadline.setDate(
          votingDeadline.getDate() + phaseDurations.voting
        );

        await this.settingsRepo.updatePhase(
          setting.channelId,
          "voting",
          votingDeadline
        );

        // Notify the channel
        try {
          await this.app.client.chat.postMessage({
            channel: setting.channelId,
            text: "📚 Suggestion phase has ended! 📚",
            blocks: [
              {
                type: "header",
                text: {
                  type: "plain_text",
                  text: "📚 Book Suggestion Phase Ended! 📚",
                  emoji: true,
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `The suggestion phase has ended. We are now in the voting phase until *${formatDate(
                    votingDeadline
                  )}*!`,
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "Use `/chapters-list` to see all suggestions and `/chapters-vote` to vote for your favorite books using ranked choice voting.",
                },
              },
            ],
          });
          console.log(
            `Transitioned channel ${setting.channelId} from suggestion to voting phase`
          );
        } catch (error) {
          console.error(
            `Error sending phase transition message to channel ${setting.channelId}:`,
            error
          );
        }
      }

      // Handle voting phase deadlines and determine winner
      if (
        setting.currentPhase === "voting" &&
        setting.votingDeadline &&
        now > setting.votingDeadline
      ) {
        try {
          // Get all votes for this channel
          const votes = await this.voteRepo.getVotesByChannel(
            setting.channelId
          );

          // If no votes, extend voting period using cycle's voting duration
          if (votes.length === 0) {
            // Extend voting by the cycle's voting duration
            const extendedDeadline = new Date();
            extendedDeadline.setDate(
              extendedDeadline.getDate() + phaseDurations.voting
            );

            await this.settingsRepo.updatePhase(
              setting.channelId,
              "voting",
              extendedDeadline
            );

            // Notify the channel
            await this.app.client.chat.postMessage({
              channel: setting.channelId,
              text: "No votes were cast in the voting period.",
              blocks: [
                {
                  type: "header",
                  text: {
                    type: "plain_text",
                    text: "📚 Voting Period Extended 📚",
                    emoji: true,
                  },
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `No votes were cast during the voting period! The voting phase has been extended until *${formatDate(
                      extendedDeadline
                    )}*!`,
                  },
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: "Use `/chapters-vote` to submit your vote.",
                  },
                },
              ],
            });

            console.log(
              `Extended voting period for channel ${setting.channelId} due to no votes`
            );
            continue;
          }

          // Get winning book using ranked choice voting
          const winningBookId = await this.tallyRankedChoiceVotes(
            setting.channelId
          );

          if (!winningBookId) {
            console.error(
              `Could not determine a winner for channel ${setting.channelId}`
            );
            continue;
          }

          // Get winning book details
          const winningBook = await this.suggestionRepo.getSuggestionById(
            winningBookId
          );

          if (!winningBook) {
            console.error(
              `Winning book with ID ${winningBookId} not found for channel ${setting.channelId}`
            );
            continue;
          }

          // Calculate reading phase deadline based on cycle's reading duration
          const readingEndDate = new Date();
          readingEndDate.setDate(
            readingEndDate.getDate() + phaseDurations.reading
          );

          // Transition to reading phase
          await this.settingsRepo.updatePhaseWithBook(
            setting.channelId,
            "reading",
            winningBookId,
            readingEndDate
          );

          // Notify the channel
          await this.app.client.chat.postMessage({
            channel: setting.channelId,
            text: `Voting has ended! The winning book is "${winningBook.title}" by ${winningBook.author}.`,
            blocks: [
              {
                type: "header",
                text: {
                  type: "plain_text",
                  text: "📚 Book Voting Results! 📚",
                  emoji: true,
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `The votes have been tallied and the winner is...\n\n*${winningBook.title}* by ${winningBook.author}!`,
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `We are now in the reading phase until *${formatDate(
                    readingEndDate
                  )}*. Happy reading!`,
                },
              },
            ],
          });

          console.log(
            `Transitioned channel ${setting.channelId} from voting to reading phase with book "${winningBook.title}"`
          );
        } catch (error) {
          console.error(
            `Error handling voting deadline for channel ${setting.channelId}:`,
            error
          );
        }
      }

      // Handle reading phase deadlines
      if (
        setting.currentPhase === "reading" &&
        setting.discussionDate &&
        now > setting.discussionDate
      ) {
        try {
          // Calculate discussion phase deadline based on cycle's discussion duration
          const discussionEndDate = new Date();
          discussionEndDate.setDate(
            discussionEndDate.getDate() + phaseDurations.discussion
          );

          // Transition to discussion phase
          await this.settingsRepo.updatePhase(
            setting.channelId,
            "discussion",
            discussionEndDate
          );

          // Get book info
          let bookInfo = "";
          if (setting.currentBookId) {
            const book = await this.suggestionRepo.getSuggestionById(
              setting.currentBookId
            );
            if (book) {
              bookInfo = `*${book.title}* by ${book.author}`;
            }
          }

          // Notify the channel
          await this.app.client.chat.postMessage({
            channel: setting.channelId,
            text: "Reading phase has ended! Time for discussion.",
            blocks: [
              {
                type: "header",
                text: {
                  type: "plain_text",
                  text: "📚 Book Reading Phase Ended! 📚",
                  emoji: true,
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `The reading phase for ${bookInfo} has ended. We are now in the discussion phase until *${formatDate(
                    discussionEndDate
                  )}*!`,
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "Share your thoughts, favorite parts, and questions about the book.",
                },
              },
            ],
          });

          console.log(
            `Transitioned channel ${setting.channelId} from reading to discussion phase`
          );
        } catch (error) {
          console.error(
            `Error handling reading deadline for channel ${setting.channelId}:`,
            error
          );
        }
      }

      // Handle discussion phase deadlines (as a separate check)
      if (
        setting.currentPhase === "discussion" &&
        setting.discussionDate &&
        now > setting.discussionDate
      ) {
        try {
          // Get the current cycle
          if (setting.currentCycleId) {
            // Complete the current cycle
            const cycle = await this.cycleRepo.getCycleById(
              setting.currentCycleId
            );
            if (cycle) {
              // Pass the winningBookId if it exists
              const winningBookId = setting.currentBookId || undefined;
              await this.cycleRepo.completeCycle(
                setting.currentCycleId,
                winningBookId
              );

              // Notify the channel that the cycle has been completed
              await this.app.client.chat.postMessage({
                channel: setting.channelId,
                text: "📚 Book Club Cycle Completed! 📚",
                blocks: [
                  {
                    type: "header",
                    text: {
                      type: "plain_text",
                      text: "📚 Book Club Cycle Completed! 📚",
                      emoji: true,
                    },
                  },
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text: `The discussion phase has ended and this book club cycle is now complete. Thanks to everyone who participated!`,
                    },
                  },
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text: "To start a new book club cycle, use the `/chapters-start-cycle` command.",
                    },
                  },
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text: "💡 *Tip:* When you start a new cycle with `/chapters-start-cycle`, you'll have the opportunity to set new phase durations.",
                    },
                  },
                ],
              });

              // Set the channel to inactive
              await this.settingsRepo.updatePhase(
                setting.channelId,
                "inactive"
              );

              console.log(
                `Completed book club cycle for channel ${setting.channelId}`
              );
            }
          }
        } catch (error) {
          console.error(
            `Error handling discussion phase completion for channel ${setting.channelId}:`,
            error
          );
        }
      }
    }
  }

  // Tally votes using ranked choice method
  private async tallyRankedChoiceVotes(
    channelId: string
  ): Promise<string | null> {
    try {
      // Get all votes for this channel
      const votes = await this.voteRepo.getVotesByChannel(channelId);

      if (votes.length === 0) {
        return null;
      }

      // Get all suggested books
      const suggestions = await this.suggestionRepo.getAllSuggestions();

      if (suggestions.length === 0) {
        return null;
      }

      // Extract all book IDs that received votes
      const bookIds = new Set<string>();
      votes.forEach((vote) => {
        vote.choices.forEach((choice) => {
          bookIds.add(choice.bookId);
        });
      });

      // Create tally object
      const tally: { [bookId: string]: number } = {};
      bookIds.forEach((id) => {
        tally[id] = 0;
      });

      // Initial count of first preferences
      votes.forEach((vote) => {
        const firstChoice = vote.choices.find((choice) => choice.rank === 1);
        if (firstChoice) {
          tally[firstChoice.bookId]++;
        }
      });

      // Check if any book has majority
      const totalVotes = votes.length;
      const majorityThreshold = Math.floor(totalVotes / 2) + 1;

      let winner: string | null = null;
      let roundsOfVoting = 1;

      // Find book with majority of first preferences
      for (const [bookId, count] of Object.entries(tally)) {
        if (count >= majorityThreshold) {
          winner = bookId;
          break;
        }
      }

      // If no winner yet, enter elimination rounds
      let eliminatedBooks = new Set<string>();

      while (!winner && roundsOfVoting < 3) {
        // Find book with lowest count
        let minCount = Number.MAX_SAFE_INTEGER;
        let bookToEliminate: string | null = null;

        for (const [bookId, count] of Object.entries(tally)) {
          if (!eliminatedBooks.has(bookId) && count < minCount) {
            minCount = count;
            bookToEliminate = bookId;
          }
        }

        if (!bookToEliminate) break;

        // Eliminate lowest book
        eliminatedBooks.add(bookToEliminate);

        // Reset tallies
        bookIds.forEach((id) => {
          if (!eliminatedBooks.has(id)) {
            tally[id] = 0;
          }
        });

        // Recount votes with the eliminated books removed
        votes.forEach((vote) => {
          // Sort choices by rank
          const sortedChoices = [...vote.choices].sort(
            (a, b) => a.rank - b.rank
          );

          // Find first non-eliminated choice
          for (const choice of sortedChoices) {
            if (!eliminatedBooks.has(choice.bookId)) {
              tally[choice.bookId]++;
              break;
            }
          }
        });

        // Check for majority winner
        for (const [bookId, count] of Object.entries(tally)) {
          if (!eliminatedBooks.has(bookId) && count >= majorityThreshold) {
            winner = bookId;
            break;
          }
        }

        roundsOfVoting++;
      }

      // If still no winner after elimination rounds, pick book with highest count
      if (!winner) {
        let maxCount = -1;

        for (const [bookId, count] of Object.entries(tally)) {
          if (!eliminatedBooks.has(bookId) && count > maxCount) {
            maxCount = count;
            winner = bookId;
          }
        }
      }

      return winner;
    } catch (error) {
      console.error("Error tallying ranked choice votes:", error);
      return null;
    }
  }
}
