import { Suggestion } from "../services";

/**
 * Interface for vote tallies with unique voter information
 */
interface VoteTallyResult {
  suggestion: Suggestion;
  totalPoints: number;
  uniqueVotersCount: number;
}

/**
 * Resolves ties when selecting a winner from book suggestions.
 * Implements a multi-step tie-breaking strategy:
 * 1. First checks for highest total points
 * 2. If tied, selects the book with the most unique voters
 * 3. If still tied, makes a random selection
 *
 * @param suggestions - Array of book suggestions to choose from
 * @param logPrefix - Optional prefix for log messages (for debugging)
 * @returns The winning suggestion
 */
export const resolveTiesAndSelectWinner = (
  suggestions: Suggestion[],
  logPrefix: string = ""
): Suggestion | null => {
  if (!suggestions || suggestions.length === 0) {
    console.log(`${logPrefix}No suggestions available to select a winner`);
    return null;
  }

  // First, compute vote tallies with unique voter counts
  const voteTallies: VoteTallyResult[] = suggestions
    .map((suggestion) => ({
      suggestion,
      totalPoints: suggestion.getTotalPoints() || 0,
      uniqueVotersCount: suggestion.getVoters().length,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  // Check if there are any votes at all
  if (voteTallies[0].totalPoints === 0) {
    console.log(`${logPrefix}No votes have been cast`);
    return null;
  }

  // Check for a tie at the highest point total
  const highestPoints = voteTallies[0].totalPoints;
  const tiedWinners = voteTallies.filter(
    (tally) => tally.totalPoints === highestPoints
  );

  console.log(
    `${logPrefix}Number of books tied for first place: ${tiedWinners.length}`
  );

  let winnerResult: VoteTallyResult;

  if (tiedWinners.length === 1) {
    // No tie, select the book with highest points
    winnerResult = tiedWinners[0];
    console.log(
      `${logPrefix}Clear winner with highest points: ${winnerResult.suggestion.getId()}`
    );
  } else {
    // We have a tie, try to break it based on the number of unique voters
    const maxUniqueVoters = Math.max(
      ...tiedWinners.map((w) => w.uniqueVotersCount)
    );
    const uniqueVoterWinners = tiedWinners.filter(
      (w) => w.uniqueVotersCount === maxUniqueVoters
    );

    console.log(
      `${logPrefix}Books tied with max unique voters (${maxUniqueVoters}): ${uniqueVoterWinners.length}`
    );

    if (uniqueVoterWinners.length === 1) {
      // Tie broken by unique voters count
      winnerResult = uniqueVoterWinners[0];
      console.log(
        `${logPrefix}Tie broken by unique voters count: ${winnerResult.suggestion.getId()}`
      );
    } else {
      // Still tied even after checking unique voters, select randomly
      const randomIndex = Math.floor(Math.random() * uniqueVoterWinners.length);
      winnerResult = uniqueVoterWinners[randomIndex];
      console.log(
        `${logPrefix}Still tied after unique voters check, selected randomly: ${winnerResult.suggestion.getId()}`
      );
    }
  }

  return winnerResult.suggestion;
};
