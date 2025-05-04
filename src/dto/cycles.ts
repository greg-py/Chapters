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
  const response = await db.collection("cycles").updateOne(
    {
      id: cycle.id,
      channelId: cycle.channelId,
      status: "active",
    },
    { $set: cycle }
  );
  return response.modifiedCount;
};
