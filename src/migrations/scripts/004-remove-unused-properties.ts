import { Db } from "mongodb";

export const id = "remove-unused-properties-20240523";
export const description =
  "Remove unused stats property from cycles and votes property from suggestions";

/**
 * Apply the migration - remove unused properties from cycles and suggestions
 */
export async function up(db: Db): Promise<void> {
  // Remove stats from cycles
  const cyclesCollection = db.collection("cycles");
  const cyclesResult = await cyclesCollection.updateMany(
    { stats: { $exists: true } },
    { $unset: { stats: "" } }
  );

  console.log(`Removed stats from ${cyclesResult.modifiedCount} cycles`);

  // Remove votes from suggestions
  const suggestionsCollection = db.collection("suggestions");
  const suggestionsResult = await suggestionsCollection.updateMany(
    { votes: { $exists: true } },
    { $unset: { votes: "" } }
  );

  console.log(
    `Removed votes from ${suggestionsResult.modifiedCount} suggestions`
  );
}

/**
 * Rollback the migration - This is a data removal migration, so rollback would require
 * having the original data, which we don't store. This function is provided
 * for completeness but will log a warning if executed.
 */
export async function down(db: Db): Promise<void> {
  console.log(
    "WARNING: Cannot restore removed properties as original values were not stored"
  );
  console.log("No changes made during rollback");
}
