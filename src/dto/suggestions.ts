import type { Db, ObjectId } from "mongodb";
import type { TSuggestion } from "../models";
import { COLLECTIONS } from "../db/constants";

export const createSuggestion = async (db: Db, suggestion: TSuggestion) => {
  const response = await db
    .collection(COLLECTIONS.SUGGESTIONS)
    .insertOne(suggestion);
  return response.insertedId;
};

export const getSuggestionsByCycle = async (db: Db, cycleId: ObjectId) => {
  const suggestions = await db
    .collection<TSuggestion>(COLLECTIONS.SUGGESTIONS)
    .find({ cycleId })
    .toArray();
  return suggestions;
};

export const getSuggestionById = async (db: Db, id: ObjectId) => {
  const suggestion = await db
    .collection(COLLECTIONS.SUGGESTIONS)
    .findOne({ _id: id });
  return suggestion;
};

export const updateSuggestion = async (
  db: Db,
  suggestion: Partial<TSuggestion>
) => {
  const response = await db
    .collection(COLLECTIONS.SUGGESTIONS)
    .updateOne({ _id: suggestion._id }, { $set: suggestion });
  return response.modifiedCount;
};

export const deleteSuggestion = async (db: Db, id: ObjectId) => {
  const response = await db
    .collection(COLLECTIONS.SUGGESTIONS)
    .deleteOne({ _id: id });
  return response.deletedCount;
};

export const deleteSuggestionsByCycle = async (db: Db, cycleId: ObjectId) => {
  const response = await db
    .collection(COLLECTIONS.SUGGESTIONS)
    .deleteMany({ cycleId });
  return response.deletedCount;
};
