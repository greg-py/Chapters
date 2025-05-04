import { ObjectId } from "mongodb";
import { connectToDatabase } from "../db/connection";
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
    private readonly link: string | undefined,
    private readonly notes: string | undefined,
    private readonly createdAt: Date,
    private readonly votes: number
  ) {}

  /**
   * Factory method to create a new Suggestion instance
   */
  public static async createNew(
    cycleId: ObjectId,
    userId: string,
    bookName: string,
    author: string,
    link?: string,
    notes?: string
  ): Promise<Suggestion> {
    const db = await connectToDatabase();

    const suggestion: TSuggestion = {
      id: new ObjectId(),
      cycleId,
      userId,
      bookName,
      author,
      link,
      notes,
      createdAt: new Date(),
      votes: 0,
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
      suggestion.votes
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
      suggestion.id,
      suggestion.cycleId,
      suggestion.userId,
      suggestion.bookName,
      suggestion.author,
      suggestion.link,
      suggestion.notes,
      suggestion.createdAt,
      suggestion.votes
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
          suggestion.id,
          suggestion.cycleId,
          suggestion.userId,
          suggestion.bookName,
          suggestion.author,
          suggestion.link,
          suggestion.notes,
          suggestion.createdAt,
          suggestion.votes
        )
    );
  }

  /**
   * Update the votes for this suggestion
   */
  public async addVote(): Promise<Suggestion> {
    const db = await connectToDatabase();
    const newVoteCount = this.votes + 1;

    const modifiedCount = await updateSuggestion(db, {
      id: this.id,
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
      newVoteCount
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
