import type { Db, ObjectId } from "mongodb";
import type { TSuggestion } from "../models";
import { COLLECTIONS } from "../db/constants";

/**
 * Creates a new book suggestion
 * @param db - MongoDB database connection
 * @param suggestion - Suggestion data to insert
 * @returns The ObjectId of the newly created suggestion
 */
export const createSuggestion = async (db: Db, suggestion: TSuggestion) => {
  const response = await db
    .collection(COLLECTIONS.SUGGESTIONS)
    .insertOne(suggestion);
  return response.insertedId;
};

/**
 * Retrieves all suggestions for a specific cycle
 * @param db - MongoDB database connection
 * @param cycleId - MongoDB ObjectId of the cycle
 * @returns Array of suggestion documents for the cycle
 */
export const getSuggestionsByCycle = async (db: Db, cycleId: ObjectId) => {
  const suggestions = await db
    .collection<TSuggestion>(COLLECTIONS.SUGGESTIONS)
    .find({ cycleId })
    .toArray();
  return suggestions;
};

/**
 * Retrieves a suggestion by its ID
 * @param db - MongoDB database connection
 * @param id - MongoDB ObjectId of the suggestion
 * @returns The suggestion document or null if not found
 */
export const getSuggestionById = async (db: Db, id: ObjectId) => {
  const suggestion = await db
    .collection(COLLECTIONS.SUGGESTIONS)
    .findOne({ _id: id });
  return suggestion;
};

/**
 * Updates an existing suggestion
 * @param db - MongoDB database connection
 * @param suggestion - Partial suggestion data with _id for the update
 * @returns Number of documents modified (0 or 1)
 */
export const updateSuggestion = async (
  db: Db,
  suggestion: Partial<TSuggestion>
) => {
  const response = await db
    .collection(COLLECTIONS.SUGGESTIONS)
    .updateOne({ _id: suggestion._id }, { $set: suggestion });
  return response.modifiedCount;
};

/**
 * Deletes a suggestion by its ID
 * @param db - MongoDB database connection
 * @param id - MongoDB ObjectId of the suggestion to delete
 * @returns Number of documents deleted (0 or 1)
 */
export const deleteSuggestion = async (db: Db, id: ObjectId) => {
  const response = await db
    .collection(COLLECTIONS.SUGGESTIONS)
    .deleteOne({ _id: id });
  return response.deletedCount;
};

/**
 * Deletes all suggestions for a specific cycle
 * @param db - MongoDB database connection
 * @param cycleId - MongoDB ObjectId of the cycle
 * @returns Number of documents deleted
 */
export const deleteSuggestionsByCycle = async (db: Db, cycleId: ObjectId) => {
  const response = await db
    .collection(COLLECTIONS.SUGGESTIONS)
    .deleteMany({ cycleId });
  return response.deletedCount;
};
