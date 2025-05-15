import { ObjectId } from "mongodb";
import { Suggestion } from "./Suggestion";
import { connectToDatabase } from "../db";
import { updateSuggestion } from "../dto";

/**
 * Service class for handling voting operations
 */
export class Vote {
  /**
   * Submit a vote for book suggestions
   * @param voteData - The vote data
   */
  public static async submitVote(voteData: {
    userId: string;
    cycleId: ObjectId;
    firstChoice: string;
    secondChoice: string | null;
    thirdChoice: string | null;
  }): Promise<void> {
    // Points allocation for ranked choice voting
    const FIRST_CHOICE_POINTS = 3;
    const SECOND_CHOICE_POINTS = 2;
    const THIRD_CHOICE_POINTS = 1;

    // Add points to first choice
    if (voteData.firstChoice) {
      const firstSuggestion = await Suggestion.getById(
        new ObjectId(voteData.firstChoice)
      );
      if (firstSuggestion) {
        await firstSuggestion.addRankedChoicePoints(
          FIRST_CHOICE_POINTS,
          voteData.userId
        );
      }
    }

    // Add points to second choice
    if (voteData.secondChoice) {
      const secondSuggestion = await Suggestion.getById(
        new ObjectId(voteData.secondChoice)
      );
      if (secondSuggestion) {
        await secondSuggestion.addRankedChoicePoints(
          SECOND_CHOICE_POINTS,
          voteData.userId
        );
      }
    }

    // Add points to third choice
    if (voteData.thirdChoice) {
      const thirdSuggestion = await Suggestion.getById(
        new ObjectId(voteData.thirdChoice)
      );
      if (thirdSuggestion) {
        await thirdSuggestion.addRankedChoicePoints(
          THIRD_CHOICE_POINTS,
          voteData.userId
        );
      }
    }
  }

  /**
   * Resets all votes for a given cycle
   * @param cycleId - The cycle ID to reset votes for
   * @returns Number of suggestions that had their votes reset
   */
  public static async resetVotesForCycle(cycleId: ObjectId): Promise<number> {
    const db = await connectToDatabase();
    const suggestions = await Suggestion.getAllForCycle(cycleId);

    // Create a batch update operation for all suggestions in the cycle
    const resetPromises = suggestions.map((suggestion) =>
      updateSuggestion(db, {
        _id: suggestion.getId(),
        totalPoints: 0,
        voters: [],
      })
    );

    // Wait for all update operations to complete
    const results = await Promise.all(resetPromises);

    // Return the count of successfully updated suggestions
    return results.reduce((count, modifiedCount) => count + modifiedCount, 0);
  }
}
