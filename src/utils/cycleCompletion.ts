import { Cycle, Suggestion, Rating } from "../services";

/**
 * Formats a comprehensive cycle completion message with all cycle data
 * @param cycle - The completed cycle
 * @returns Promise<string> - The formatted completion message
 */
export async function formatCycleCompletionMessage(
  cycle: Cycle
): Promise<string> {
  const cycleName = cycle.getName();
  const selectedBookId = cycle.getSelectedBookId();

  let message = `:tada: *Book Club Cycle Completed!*\n\n`;
  message += `The book club cycle "*${cycleName}*" has been completed and archived.\n\n`;

  // Get the selected book if available
  let selectedBook: Suggestion | null = null;
  if (selectedBookId) {
    selectedBook = await Suggestion.getById(selectedBookId);
  }

  if (selectedBook) {
    // Book information section
    message += `:trophy: *Selected Book*\n`;
    message += `> :book: *"${selectedBook.getBookName()}"*\n`;
    message += `> :writing_hand: by *${selectedBook.getAuthor()}*\n`;

    const bookLink = selectedBook.getLink();
    if (bookLink) {
      message += `> :link: <${bookLink}|View Book Details>\n`;
    }

    const bookNotes = selectedBook.getNotes();
    if (bookNotes) {
      message += `> :memo: ${bookNotes}\n`;
    }
    message += `\n`;
  }

  // Voting results section
  const suggestions = await Suggestion.getAllForCycle(cycle.getId());
  if (suggestions.length > 0) {
    message += `:ballot_box_with_ballot: *Voting Summary*\n`;

    // Sort suggestions by vote count
    const sortedSuggestions = [...suggestions].sort((a, b) => {
      const aVotes = a.getTotalPoints() || 0;
      const bVotes = b.getTotalPoints() || 0;
      return bVotes - aVotes;
    });

    // Show top 3 results compactly
    const topBooks = sortedSuggestions.slice(0, 3);
    topBooks.forEach((suggestion, index) => {
      const voteCount = suggestion.getTotalPoints() || 0;
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
      message += `${medal} *${suggestion.getBookName()}* (${voteCount} pts)\n`;
    });

    // Show total participation
    const allVoters = new Set<string>();
    suggestions.forEach((suggestion) => {
      suggestion.getVoters().forEach((voter) => allVoters.add(voter));
    });

    if (suggestions.length > 3) {
      message += `... and ${suggestions.length - 3} other book${
        suggestions.length - 3 === 1 ? "" : "s"
      }\n`;
    }
    message += `*${allVoters.size} member${
      allVoters.size === 1 ? "" : "s"
    } participated in voting*\n\n`;
  }

  // Reading phase duration
  const phaseTimings = cycle.getPhaseTimings();
  if (phaseTimings?.reading?.startDate && phaseTimings?.reading?.endDate) {
    const readingStart = phaseTimings.reading.startDate;
    const readingEnd = phaseTimings.reading.endDate;
    const readingDays = Math.ceil(
      (readingEnd.getTime() - readingStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    message += `:calendar: *Reading Phase*\n`;
    message += `Duration: ${readingDays} day${readingDays === 1 ? "" : "s"}\n`;
    message += `From ${readingStart.toLocaleDateString()} to ${readingEnd.toLocaleDateString()}\n\n`;
  }

  // Rating results section
  if (selectedBookId) {
    const ratingStats = await Rating.getStatsForCycle(cycle.getId());

    if (ratingStats.totalRatings > 0) {
      message += `:star: *Book Ratings*\n`;

      // Generate star display for average rating
      const fullStars = Math.floor(ratingStats.averageRating);
      const hasHalfStar = ratingStats.averageRating % 1 >= 0.5;
      const starDisplay = "⭐".repeat(fullStars) + (hasHalfStar ? "✨" : "");

      message += `Average: ${starDisplay} ${ratingStats.averageRating}/10\n`;
      message += `${ratingStats.recommendationPercentage}% would recommend\n`;
      message += `*${ratingStats.totalRatings} member${
        ratingStats.totalRatings === 1 ? "" : "s"
      } rated this book*\n\n`;
    }
  }

  // Cycle summary
  const stats = await cycle.getStats();
  message += `:books: *Cycle Summary*\n`;
  message += `• ${stats.totalSuggestions} book suggestion${
    stats.totalSuggestions === 1 ? "" : "s"
  }\n`;
  message += `• ${stats.totalVotes} member${
    stats.totalVotes === 1 ? "" : "s"
  } voted\n`;

  // Calculate total cycle duration if we have start and end dates
  const cycleStart = cycle.getStartDate();
  const discussionEndDate = phaseTimings?.discussion?.endDate;
  if (discussionEndDate) {
    const totalDays = Math.ceil(
      (discussionEndDate.getTime() - cycleStart.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    message += `• ${totalDays} day${
      totalDays === 1 ? "" : "s"
    } total cycle duration\n`;
  }

  message += `\n:sparkles: *Thank you to everyone who participated!* :sparkles:\n\n`;
  message += `To start a new book club cycle, use the \`/chapters-start-cycle\` command.`;

  return message;
}
