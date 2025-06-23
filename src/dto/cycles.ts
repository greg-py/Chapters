import type { Db, ObjectId } from "mongodb";
import type { TCycle } from "../models";
import { COLLECTIONS } from "../db/constants";

/**
 * Retrieves the active cycle for a specific channel
 * @param db - MongoDB database connection
 * @param channelId - Slack channel ID
 * @returns The active cycle data or null if none exists
 */
export const getActiveCycleInChannel = async (db: Db, channelId: string) => {
  const cycle = await db.collection(COLLECTIONS.CYCLES).findOne({
    channelId,
    status: "active",
  });
  return cycle;
};

/**
 * Retrieves all active cycles from the database
 * @param db - MongoDB database connection
 * @returns Array of all active cycle documents
 */
export const getAllActiveCycles = async (db: Db) => {
  return await db
    .collection(COLLECTIONS.CYCLES)
    .find({ status: "active" })
    .toArray();
};

/**
 * Retrieves a cycle by its ObjectId
 * @param db - MongoDB database connection
 * @param id - MongoDB ObjectId of the cycle
 * @returns The cycle document or null if not found
 */
export const getCycleById = async (db: Db, id: ObjectId) => {
  return await db.collection(COLLECTIONS.CYCLES).findOne({ _id: id });
};

/**
 * Creates a new cycle in the database
 * @param db - MongoDB database connection
 * @param cycle - Cycle data to insert
 * @returns The ObjectId of the newly created cycle
 */
export const createCycle = async (db: Db, cycle: TCycle) => {
  const response = await db.collection(COLLECTIONS.CYCLES).insertOne(cycle);

  return response.insertedId;
};

/**
 * Updates an existing cycle
 * @param db - MongoDB database connection
 * @param cycle - Partial cycle data with _id for the update
 * @returns Number of documents modified (0 or 1)
 */
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

  // Create the filter - only require active status if we're not updating the status itself
  // This allows us to update completed cycles for things like setting phase end dates
  const filter: { _id: ObjectId; channelId: string; status?: string } = {
    _id: cycle._id!,
    channelId: cycle.channelId!,
  };

  // Only require active status if we're not changing the status
  if (!cycle.status) {
    filter.status = "active";
  }

  const response = await db
    .collection(COLLECTIONS.CYCLES)
    .updateOne(filter, updateOperation);
  return response.modifiedCount;
};

/**
 * Deletes a cycle by its ID
 * @param db - MongoDB database connection
 * @param id - MongoDB ObjectId of the cycle to delete
 * @returns Number of documents deleted (0 or 1)
 */
export const deleteCycleById = async (db: Db, id: ObjectId) => {
  const response = await db
    .collection(COLLECTIONS.CYCLES)
    .deleteOne({ _id: id });
  return response.deletedCount;
};
