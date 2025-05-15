import type { Db, ObjectId } from "mongodb";
import { COLLECTIONS } from "../db/constants";

export interface TVote {
  _id?: ObjectId;
  userId: string;
  cycleId: ObjectId;
  firstChoice: string;
  secondChoice: string | null;
  thirdChoice: string | null;
  createdAt: Date;
}

/**
 * Creates a new vote in the database
 * @param db - MongoDB database connection
 * @param vote - Vote data to insert
 * @returns The ObjectId of the newly created vote
 */
export const createVote = async (db: Db, vote: TVote) => {
  const response = await db.collection(COLLECTIONS.VOTES).insertOne(vote);
  return response.insertedId;
};

/**
 * Retrieves all votes by a specific user for a cycle
 * @param db - MongoDB database connection
 * @param userId - Slack user ID
 * @param cycleId - MongoDB ObjectId of the cycle
 * @returns Array of vote documents
 */
export const getVotesByUser = async (
  db: Db,
  userId: string,
  cycleId: ObjectId
) => {
  const votes = await db
    .collection<TVote>(COLLECTIONS.VOTES)
    .find({ userId, cycleId })
    .toArray();
  return votes;
};

/**
 * Retrieves all votes for a specific cycle
 * @param db - MongoDB database connection
 * @param cycleId - MongoDB ObjectId of the cycle
 * @returns Array of all vote documents for the cycle
 */
export const getVotesByCycle = async (db: Db, cycleId: ObjectId) => {
  const votes = await db
    .collection<TVote>(COLLECTIONS.VOTES)
    .find({ cycleId })
    .toArray();
  return votes;
};

/**
 * Deletes all votes by a specific user for a cycle
 * @param db - MongoDB database connection
 * @param userId - Slack user ID
 * @param cycleId - MongoDB ObjectId of the cycle
 * @returns Number of documents deleted
 */
export const deleteVotesByUser = async (
  db: Db,
  userId: string,
  cycleId: ObjectId
) => {
  const response = await db
    .collection(COLLECTIONS.VOTES)
    .deleteMany({ userId, cycleId });
  return response.deletedCount;
};

/**
 * Deletes all votes for a specific cycle
 * @param db - MongoDB database connection
 * @param cycleId - MongoDB ObjectId of the cycle
 * @returns Number of documents deleted
 */
export const deleteVotesByCycle = async (db: Db, cycleId: ObjectId) => {
  const response = await db
    .collection(COLLECTIONS.VOTES)
    .deleteMany({ cycleId });
  return response.deletedCount;
};
