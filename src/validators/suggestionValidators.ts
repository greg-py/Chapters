import { Suggestion, Cycle } from "../services";
import { CyclePhase, ActionId, BlockId } from "../constants";
import { validateCyclePhase } from "./cycleValidators";
import type { BlockAction } from "@slack/bolt";
import { ObjectId } from "mongodb";

/**
 * Validates prerequisites for suggesting a book (active cycle exists and is in Suggestion phase).
 * @param cycle The active Cycle instance.
 * @throws Error if validation fails.
 */
export function validateSuggestionPrerequisites(cycle: Cycle): void {
  validateCyclePhase(cycle, CyclePhase.SUGGESTION, "suggestion");
}

/**
 * Validates prerequisites for viewing/starting the voting process.
 * Checks for active cycle, voting phase, minimum suggestions, and if user has already voted.
 * @param cycle The active Cycle instance.
 * @param userId The ID of the user initiating the vote/view.
 * @param checkVoteStatus If true, checks if the user has already voted. Set to false for just viewing results.
 * @returns The list of Suggestions for the cycle.
 * @throws Error if validation fails.
 */
export async function validateVotingPrerequisites(
  cycle: Cycle,
  userId: string,
  checkVoteStatus: boolean = true
): Promise<Suggestion[]> {
  validateCyclePhase(cycle, CyclePhase.VOTING, "voting");

  const suggestions = await Suggestion.getAllForCycle(cycle.getId());

  if (suggestions.length === 0) {
    throw new Error(
      "No suggestions found for this cycle. Use `/chapters-suggest-book` to add suggestions before voting."
    );
  } else if (suggestions.length < 3) {
    // Allowing voting with < 3 might be okay, but ranked choice works best with more options.
    // Throwing an error for now, but this could be a warning or configurable.
    throw new Error(
      `At least 3 book suggestions are recommended for ranked choice voting (currently ${suggestions.length}). Use \`/chapters-suggest-book\` to add more.`
    );
  }

  if (checkVoteStatus) {
    const hasVoted = await Suggestion.hasUserVotedInCycle(
      userId,
      cycle.getId()
    );
    if (hasVoted) {
      throw new Error(
        "You have already voted in this cycle. Use `/chapters-voting-results` to see the current standings."
      );
    }
  }

  return suggestions;
}

/**
 * Validates the input fields from the book suggestion submission.
 * @param bookName
 * @param bookAuthor
 * @param bookLink
 * @throws Error if any validation fails.
 */
export function validateSuggestionInputs(
  bookName: string | undefined | null,
  bookAuthor: string | undefined | null,
  bookLink: string | undefined | null
): void {
  if (!bookName) {
    throw new Error("Book Title is required. Please enter a valid title.");
  }
  if (!bookAuthor) {
    throw new Error("Author is required. Please enter a valid author name.");
  }
  if (!bookLink) {
    throw new Error(
      "Link is required. Please enter a valid URL (e.g., Goodreads, Amazon)."
    );
  }
  // Basic URL validation
  try {
    new URL(bookLink);
  } catch (_) {
    throw new Error(
      "Invalid Link format. Please enter a valid URL (e.g., https://... )."
    );
  }
}

/**
 * Validates the payload from the vote submission action.
 * Checks that choices are valid ObjectIds, unique, and correspond to existing suggestions.
 * @param body The BlockAction body from the vote submission.
 * @param cycleSuggestions The list of valid Suggestion objects for the current cycle.
 * @returns An object containing the validated ObjectId choices.
 * @throws Error if validation fails.
 */
export function validateVoteSubmissionPayload(
  body: BlockAction,
  cycleSuggestions: Suggestion[]
): {
  firstChoiceId?: ObjectId;
  secondChoiceId?: ObjectId;
  thirdChoiceId?: ObjectId;
} {
  if (!body.state?.values) {
    throw new Error("Could not read vote selections from submission.");
  }
  const values = body.state.values;

  const firstChoiceStr = (
    values[BlockId.FIRST_CHOICE]?.[ActionId.FIRST_CHOICE_SELECT]
      ?.selected_option?.value || ""
  ).trim();
  const secondChoiceStr = (
    values[BlockId.SECOND_CHOICE]?.[ActionId.SECOND_CHOICE_SELECT]
      ?.selected_option?.value || ""
  ).trim();
  const thirdChoiceStr = (
    values[BlockId.THIRD_CHOICE]?.[ActionId.THIRD_CHOICE_SELECT]
      ?.selected_option?.value || ""
  ).trim();

  if (!firstChoiceStr && !secondChoiceStr && !thirdChoiceStr) {
    throw new Error("Please select at least one book to vote for.");
  }

  const selections = [firstChoiceStr, secondChoiceStr, thirdChoiceStr].filter(
    Boolean
  );
  const uniqueSelections = new Set(selections);
  if (uniqueSelections.size < selections.length) {
    throw new Error("You cannot vote for the same book multiple times.");
  }

  const validSuggestionIds = new Set(
    cycleSuggestions.map((s) => s.getId().toString())
  );
  const validatedChoices: {
    firstChoiceId?: ObjectId;
    secondChoiceId?: ObjectId;
    thirdChoiceId?: ObjectId;
  } = {};

  try {
    if (firstChoiceStr) {
      if (!validSuggestionIds.has(firstChoiceStr))
        throw new Error(`Invalid 1st choice ID: ${firstChoiceStr}`);
      validatedChoices.firstChoiceId = new ObjectId(firstChoiceStr);
    }
    if (secondChoiceStr) {
      if (!validSuggestionIds.has(secondChoiceStr))
        throw new Error(`Invalid 2nd choice ID: ${secondChoiceStr}`);
      validatedChoices.secondChoiceId = new ObjectId(secondChoiceStr);
    }
    if (thirdChoiceStr) {
      if (!validSuggestionIds.has(thirdChoiceStr))
        throw new Error(`Invalid 3rd choice ID: ${thirdChoiceStr}`);
      validatedChoices.thirdChoiceId = new ObjectId(thirdChoiceStr);
    }
  } catch (e) {
    // Catch ObjectId creation errors or the thrown errors above
    throw new Error(
      `Invalid selection format or suggestion ID. ${(e as Error).message}`
    );
  }

  return validatedChoices;
}
