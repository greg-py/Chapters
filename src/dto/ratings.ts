import type { Db, ObjectId } from "mongodb";
import { COLLECTIONS } from "../db/constants";

export interface TRating {
  _id?: ObjectId;
  cycleId: ObjectId;
  userId: string;
  bookId: ObjectId;
  rating: number;
  recommend: boolean;
  createdAt: Date;
}

/**
 * Creates a new rating in the database
 * @param db - MongoDB database connection
 * @param rating - Rating data to insert
 * @returns The ObjectId of the newly created rating
 */
export const createRating = async (db: Db, rating: TRating) => {
  const response = await db.collection(COLLECTIONS.RATINGS).insertOne(rating);
  return response.insertedId;
};

/**
 * Retrieves all ratings by a specific user for a cycle
 * @param db - MongoDB database connection
 * @param userId - Slack user ID
 * @param cycleId - MongoDB ObjectId of the cycle
 * @returns Array of rating documents
 */
export const getRatingsByUser = async (
  db: Db,
  userId: string,
  cycleId: ObjectId
) => {
  const ratings = await db
    .collection<TRating>(COLLECTIONS.RATINGS)
    .find({ userId, cycleId })
    .toArray();
  return ratings;
};

/**
 * Retrieves all ratings for a specific cycle
 * @param db - MongoDB database connection
 * @param cycleId - MongoDB ObjectId of the cycle
 * @returns Array of all rating documents for the cycle
 */
export const getRatingsByCycle = async (db: Db, cycleId: ObjectId) => {
  const ratings = await db
    .collection<TRating>(COLLECTIONS.RATINGS)
    .find({ cycleId })
    .toArray();
  return ratings;
};

/**
 * Deletes all ratings by a specific user for a cycle
 * @param db - MongoDB database connection
 * @param userId - Slack user ID
 * @param cycleId - MongoDB ObjectId of the cycle
 * @returns Number of documents deleted
 */
export const deleteRatingsByUser = async (
  db: Db,
  userId: string,
  cycleId: ObjectId
) => {
  const response = await db
    .collection(COLLECTIONS.RATINGS)
    .deleteMany({ userId, cycleId });
  return response.deletedCount;
};

/**
 * Deletes all ratings for a specific cycle
 * @param db - MongoDB database connection
 * @param cycleId - MongoDB ObjectId of the cycle
 * @returns Number of documents deleted
 */
export const deleteRatingsByCycle = async (db: Db, cycleId: ObjectId) => {
  const response = await db
    .collection(COLLECTIONS.RATINGS)
    .deleteMany({ cycleId });
  return response.deletedCount;
};
