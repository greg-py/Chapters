import { ObjectId } from "mongodb";
import { connectToDatabase } from "../db";
import {
  createSuggestion,
  getSuggestionById,
  getSuggestionsByCycle,
  updateSuggestion,
  deleteSuggestion,
} from "../dto";
import type { TSuggestion } from "../models";

/**
 * Represents a book suggestion within a book club cycle
 */
export class Suggestion {
  constructor(
    private readonly id: ObjectId,
    private readonly cycleId: ObjectId,
    private readonly userId: string,
    private readonly bookName: string,
    private readonly author: string,
    private readonly link: string,
    private readonly notes: string | undefined,
    private readonly createdAt: Date,
    private readonly votes: number,
    private readonly totalPoints: number = 0,
    private readonly voters: string[] = []
  ) {}

  /**
   * Factory method to create a new Suggestion instance
   */
  public static async createNew(
    cycleId: ObjectId,
    userId: string,
    bookName: string,
    author: string,
    link: string,
    notes?: string
  ): Promise<Suggestion> {
    const db = await connectToDatabase();

    const suggestion: TSuggestion = {
      _id: new ObjectId(),
      cycleId,
      userId,
      bookName,
      author,
      link,
      notes,
      createdAt: new Date(),
      votes: 0,
      totalPoints: 0,
      voters: [],
    };

    // Insert the suggestion into the database
    const suggestionId = await createSuggestion(db, suggestion);

    return new Suggestion(
      suggestionId,
      suggestion.cycleId,
      suggestion.userId,
      suggestion.bookName,
      suggestion.author,
      suggestion.link,
      suggestion.notes,
      suggestion.createdAt,
      suggestion.votes,
      suggestion.totalPoints,
      suggestion.voters
    );
  }

  /**
   * Factory method to get a suggestion by ID
   */
  public static async getById(id: ObjectId): Promise<Suggestion | null> {
    const db = await connectToDatabase();
    const suggestion = await getSuggestionById(db, id);

    if (!suggestion) {
      return null;
    }

    return new Suggestion(
      suggestion._id!,
      suggestion.cycleId,
      suggestion.userId,
      suggestion.bookName,
      suggestion.author,
      suggestion.link,
      suggestion.notes,
      suggestion.createdAt,
      suggestion.votes,
      suggestion.totalPoints,
      suggestion.voters
    );
  }

  /**
   * Factory method to get all suggestions for a cycle
   */
  public static async getAllForCycle(cycleId: ObjectId): Promise<Suggestion[]> {
    const db = await connectToDatabase();
    const suggestions = await getSuggestionsByCycle(db, cycleId);

    return suggestions.map(
      (suggestion) =>
        new Suggestion(
          suggestion._id!,
          suggestion.cycleId,
          suggestion.userId,
          suggestion.bookName,
          suggestion.author,
          suggestion.link,
          suggestion.notes,
          suggestion.createdAt,
          suggestion.votes,
          suggestion.totalPoints,
          suggestion.voters
        )
    );
  }

  /**
   * Check if a user has already voted in the cycle
   * @param userId - The ID of the user to check
   * @param cycleId - The ID of the cycle
   * @returns true if the user has already voted, false otherwise
   */
  public static async hasUserVotedInCycle(
    userId: string,
    cycleId: ObjectId
  ): Promise<boolean> {
    const db = await connectToDatabase();
    const suggestions = await getSuggestionsByCycle(db, cycleId);

    // Check if the user exists in any suggestion's voters array for this cycle
    return suggestions.some((suggestion) =>
      suggestion.voters?.includes(userId)
    );
  }

  /**
   * Update the votes for this suggestion
   */
  public async addVote(): Promise<Suggestion> {
    const db = await connectToDatabase();
    const newVoteCount = this.votes + 1;

    const modifiedCount = await updateSuggestion(db, {
      _id: this.id,
      votes: newVoteCount,
    });

    if (modifiedCount === 0) {
      throw new Error("Failed to update vote count. Please try again.");
    }

    return new Suggestion(
      this.id,
      this.cycleId,
      this.userId,
      this.bookName,
      this.author,
      this.link,
      this.notes,
      this.createdAt,
      newVoteCount,
      this.totalPoints,
      this.voters
    );
  }

  /**
   * Add points for ranked choice voting
   * @param points - The points to add (3 for 1st choice, 2 for 2nd, 1 for 3rd)
   * @param voterId - The ID of the user who voted
   */
  public async addRankedChoicePoints(
    points: number,
    voterId: string
  ): Promise<Suggestion> {
    const db = await connectToDatabase();
    const newTotalPoints = this.totalPoints + points;
    const newVoters = [...this.voters, voterId];

    const modifiedCount = await updateSuggestion(db, {
      _id: this.id,
      totalPoints: newTotalPoints,
      voters: newVoters,
    });

    if (modifiedCount === 0) {
      throw new Error("Failed to update vote points. Please try again.");
    }

    return new Suggestion(
      this.id,
      this.cycleId,
      this.userId,
      this.bookName,
      this.author,
      this.link,
      this.notes,
      this.createdAt,
      this.votes,
      newTotalPoints,
      newVoters
    );
  }

  /**
   * Delete this suggestion
   */
  public async delete(): Promise<boolean> {
    const db = await connectToDatabase();
    const deletedCount = await deleteSuggestion(db, this.id);
    return deletedCount > 0;
  }

  // Getters
  public getId() {
    return this.id;
  }

  public getCycleId() {
    return this.cycleId;
  }

  public getUserId() {
    return this.userId;
  }

  public getBookName() {
    return this.bookName;
  }

  public getAuthor() {
    return this.author;
  }

  public getLink() {
    return this.link;
  }

  public getNotes() {
    return this.notes;
  }

  public getCreatedAt() {
    return this.createdAt;
  }

  public getVotes() {
    return this.votes;
  }

  public getTotalPoints() {
    return this.totalPoints;
  }

  public getVoters() {
    return this.voters;
  }

  /**
   * Format the suggestion data for display in Slack
   */
  public formatForDisplay() {
    return {
      bookName: this.bookName,
      author: this.author,
      link: this.link || "Not provided",
      notes: this.notes || "Not provided",
    };
  }
}
