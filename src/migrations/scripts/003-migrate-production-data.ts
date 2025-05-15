import { Db, ObjectId } from "mongodb";

export const id = "migrate-production-data-20240513";
export const description =
  "Migrate production data to current schema - combine phase timings and ID updates";

/**
 * Apply the migration - add phaseTimings and handle ID references for production data
 */
export async function up(db: Db): Promise<void> {
  // PART 1: Add phaseTimings field to all cycles
  const cyclesCollection = db.collection("cycles");

  // Find all active cycles without phaseTimings
  const activeCycles = await cyclesCollection
    .find({
      status: "active",
      phaseTimings: { $exists: false },
    })
    .toArray();

  console.log(
    `Migrating ${activeCycles.length} active cycles to add phaseTimings`
  );

  // For each active cycle, add phaseTimings with the current phase start date
  for (const cycle of activeCycles) {
    // Use the cycle's startDate as a base if current phase is "suggestion",
    // otherwise create a reasonable start date
    const phaseTimings = {
      suggestion: {},
      voting: {},
      reading: {},
      discussion: {},
    };

    // Set the start time for the current phase
    const currentPhase = cycle.currentPhase;
    if (
      currentPhase &&
      typeof currentPhase === "string" &&
      (currentPhase === "suggestion" ||
        currentPhase === "voting" ||
        currentPhase === "reading" ||
        currentPhase === "discussion")
    ) {
      // If we're in suggestion phase, use the cycle's startDate
      if (currentPhase === "suggestion") {
        phaseTimings[currentPhase] = { startDate: cycle.startDate };
      } else {
        // For other phases, calculate a reasonable start date based on phase durations
        const now = new Date();
        let calculatedStartDate = now;

        if (cycle.phaseDurations && cycle.phaseDurations[currentPhase]) {
          const phaseDuration = cycle.phaseDurations[currentPhase];
          const daysSinceStart = Math.floor(
            Math.random() * phaseDuration * 0.7
          ); // Random point in first 70% of phase
          calculatedStartDate = new Date(
            now.getTime() - daysSinceStart * 24 * 60 * 60 * 1000
          );
        }

        phaseTimings[currentPhase] = { startDate: calculatedStartDate };
      }
    }

    await cyclesCollection.updateOne(
      { _id: cycle._id },
      { $set: { phaseTimings } }
    );
  }

  // Also add empty phaseTimings to non-active cycles for consistency
  const inactiveCycles = await cyclesCollection
    .find({
      status: { $ne: "active" },
      phaseTimings: { $exists: false },
    })
    .toArray();

  console.log(
    `Migrating ${inactiveCycles.length} inactive cycles to add phaseTimings`
  );

  if (inactiveCycles.length > 0) {
    await cyclesCollection.updateMany(
      { status: { $ne: "active" }, phaseTimings: { $exists: false } },
      {
        $set: {
          phaseTimings: {
            suggestion: {},
            voting: {},
            reading: {},
            discussion: {},
          },
        },
      }
    );
  }

  // PART 2: Handle ID mappings and references

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
  // In production data, this is cycleId referring to the cycle's id field
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

  console.log("Production data migration complete");
}

/**
 * Rollback the migration
 */
export async function down(db: Db): Promise<void> {
  // Part 1: Roll back phaseTimings
  const cyclesCollection = db.collection("cycles");
  const cyclesResult = await cyclesCollection.updateMany(
    { phaseTimings: { $exists: true } },
    { $unset: { phaseTimings: "" } }
  );

  console.log(`Removed phaseTimings from ${cyclesResult.modifiedCount} cycles`);

  // Part 2: Roll back ID fields (best effort)
  console.log("WARNING: Rolling back ID removal is a best-effort operation.");
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
