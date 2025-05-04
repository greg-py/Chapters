import type { Db, ObjectId } from "mongodb";
import type { TSuggestion } from "../models";

export const createSuggestion = async (db: Db, suggestion: TSuggestion) => {
  const response = await db.collection("suggestions").insertOne(suggestion);
  return response.insertedId;
};

export const getSuggestionsByCycle = async (db: Db, cycleId: ObjectId) => {
  const suggestions = await db
    .collection<TSuggestion>("suggestions")
    .find({ cycleId })
    .toArray();
  return suggestions;
};

export const getSuggestionById = async (db: Db, id: ObjectId) => {
  const suggestion = await db.collection("suggestions").findOne({ id });
  return suggestion;
};

export const updateSuggestion = async (
  db: Db,
  suggestion: Partial<TSuggestion>
) => {
  const response = await db
    .collection("suggestions")
    .updateOne({ id: suggestion.id }, { $set: suggestion });
  return response.modifiedCount;
};

export const deleteSuggestion = async (db: Db, id: ObjectId) => {
  const response = await db.collection("suggestions").deleteOne({ id });
  return response.deletedCount;
};
