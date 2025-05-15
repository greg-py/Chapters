import type { Db, ObjectId } from "mongodb";
import type { TCycle } from "../models";
import { COLLECTIONS } from "../db/constants";

export const getActiveCycleInChannel = async (db: Db, channelId: string) => {
  const cycle = await db.collection(COLLECTIONS.CYCLES).findOne({
    channelId,
    status: "active",
  });
  return cycle;
};

export const createCycle = async (db: Db, cycle: TCycle) => {
  const response = await db.collection(COLLECTIONS.CYCLES).insertOne(cycle);

  return response.insertedId;
};

export const updateCycle = async (db: Db, cycle: Partial<TCycle>) => {
  // Check if selectedBookId is explicitly undefined to handle unsetting the field
  const hasSelectedBookIdToUnset =
    "selectedBookId" in cycle && cycle.selectedBookId === undefined;

  // Create the operation object
  const updateOperation: { $set: Partial<TCycle>; $unset?: Record<string, 1> } =
    {
      $set: { ...cycle },
    };

  // If we need to unset selectedBookId
  if (hasSelectedBookIdToUnset) {
    // Remove it from $set since it's undefined
    delete updateOperation.$set.selectedBookId;
    // Add it to $unset
    updateOperation.$unset = { selectedBookId: 1 };
  }

  const response = await db.collection(COLLECTIONS.CYCLES).updateOne(
    {
      _id: cycle._id,
      channelId: cycle.channelId,
      status: "active",
    },
    updateOperation
  );
  return response.modifiedCount;
};

export const deleteCycleById = async (db: Db, id: ObjectId) => {
  const response = await db
    .collection(COLLECTIONS.CYCLES)
    .deleteOne({ _id: id });
  return response.deletedCount;
};
