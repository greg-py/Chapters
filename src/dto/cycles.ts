import type { Db } from "mongodb";
import type { TCycle } from "../models";

export const getActiveCycleInChannel = async (db: Db, channelId: string) => {
  const cycle = await db.collection("cycles").findOne({
    channelId,
    status: "active",
  });
  return cycle;
};

export const createCycle = async (db: Db, cycle: TCycle) => {
  const response = await db.collection("cycles").insertOne(cycle);

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

  const response = await db.collection("cycles").updateOne(
    {
      id: cycle.id,
      channelId: cycle.channelId,
      status: "active",
    },
    updateOperation
  );
  return response.modifiedCount;
};
