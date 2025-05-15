import { Db, ObjectId } from "mongodb";

export const id = "remove-duplicate-ids-20240513";
export const description =
  "Remove redundant id field when _id exists and update references";

/**
 * Apply the migration - remove duplicate ID fields and update references
 */
export async function up(db: Db): Promise<void> {
  // Collections that need the duplicate ID removed
  const collections = ["cycles", "suggestions", "votes"];

  // Store document ID mappings for reference updates
  const idMappings = new Map<string, ObjectId>();

  // First, build a mapping of old ids to new _ids for all documents
  console.log("Building ID mappings for reference updates...");

  for (const collectionName of collections) {
    const collection = db.collection(collectionName);
    const documents = await collection
      .find({ id: { $exists: true } })
      .toArray();

    console.log(
      `Found ${documents.length} documents with duplicate IDs in ${collectionName}`
    );

    for (const doc of documents) {
      if (doc.id && doc._id) {
        // Store mapping from string ID to ObjectID
        idMappings.set(doc.id.toString(), doc._id);
      }
    }
  }

  console.log(`Created ${idMappings.size} ID mappings for reference updates`);

  // Update references in suggestions to cycles
  const suggestionsCollection = db.collection("suggestions");
  const suggestionsWithCycleId = await suggestionsCollection
    .find({
      cycleId: { $exists: true, $ne: null },
    })
    .toArray();

  console.log(
    `Found ${suggestionsWithCycleId.length} suggestions with cycleId references to update`
  );

  let updatedReferences = 0;

  for (const suggestion of suggestionsWithCycleId) {
    const oldCycleId = suggestion.cycleId
      ? suggestion.cycleId.toString()
      : null;

    if (oldCycleId && idMappings.has(oldCycleId)) {
      const newCycleId = idMappings.get(oldCycleId);

      // Only update if the old ID is different from _id
      if (newCycleId && !newCycleId.equals(suggestion.cycleId)) {
        await suggestionsCollection.updateOne(
          { _id: suggestion._id },
          { $set: { cycleId: newCycleId } }
        );

        updatedReferences++;
      }
    }
  }

  console.log(`Updated ${updatedReferences} cycleId references in suggestions`);

  // Update references in votes to suggestions
  const votesCollection = db.collection("votes");
  const votesWithSuggestionId = await votesCollection
    .find({
      suggestionId: { $exists: true, $ne: null },
    })
    .toArray();

  console.log(
    `Found ${votesWithSuggestionId.length} votes with suggestionId references to update`
  );

  updatedReferences = 0;

  for (const vote of votesWithSuggestionId) {
    const oldSuggestionId = vote.suggestionId
      ? vote.suggestionId.toString()
      : null;

    if (oldSuggestionId && idMappings.has(oldSuggestionId)) {
      const newSuggestionId = idMappings.get(oldSuggestionId);

      // Only update if the old ID is different from _id
      if (newSuggestionId && !newSuggestionId.equals(vote.suggestionId)) {
        await votesCollection.updateOne(
          { _id: vote._id },
          { $set: { suggestionId: newSuggestionId } }
        );

        updatedReferences++;
      }
    }
  }

  console.log(`Updated ${updatedReferences} suggestionId references in votes`);

  // After updating all references, remove the duplicate id fields
  for (const collectionName of collections) {
    const collection = db.collection(collectionName);
    const result = await collection.updateMany(
      { id: { $exists: true } },
      { $unset: { id: "" } }
    );

    console.log(
      `Removed duplicate id field from ${result.modifiedCount} documents in ${collectionName}`
    );
  }

  console.log("Duplicate ID removal complete");
}

/**
 * Rollback the migration - add back id fields that match _id
 *
 * NOTE: This is a best-effort rollback. The original ids may not be recoverable
 * if they were custom values rather than copies of _id.
 */
export async function down(db: Db): Promise<void> {
  console.log(
    "WARNING: Rolling back this migration is a best-effort operation."
  );
  console.log("The original ids may not match if they were custom values.");

  const collections = ["cycles", "suggestions", "votes"];

  for (const collectionName of collections) {
    const collection = db.collection(collectionName);
    const documents = await collection
      .find({ id: { $exists: false } })
      .toArray();

    console.log(
      `Adding back id field to ${documents.length} documents in ${collectionName}`
    );

    for (const doc of documents) {
      await collection.updateOne({ _id: doc._id }, { $set: { id: doc._id } });
    }
  }

  console.log("Rollback complete, but references may not be fully restored.");
}
