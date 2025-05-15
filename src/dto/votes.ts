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

export const createVote = async (db: Db, vote: TVote) => {
  const response = await db.collection(COLLECTIONS.VOTES).insertOne(vote);
  return response.insertedId;
};

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

export const getVotesByCycle = async (db: Db, cycleId: ObjectId) => {
  const votes = await db
    .collection<TVote>(COLLECTIONS.VOTES)
    .find({ cycleId })
    .toArray();
  return votes;
};

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

export const deleteVotesByCycle = async (db: Db, cycleId: ObjectId) => {
  const response = await db
    .collection(COLLECTIONS.VOTES)
    .deleteMany({ cycleId });
  return response.deletedCount;
};
