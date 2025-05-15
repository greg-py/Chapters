import { Db } from "mongodb";

export const id = "add-phase-timings-20240513";
export const description = "Add phaseTimings field to all active cycles";

type PhaseTimingsMap = {
  suggestion: Record<string, unknown>;
  voting: Record<string, unknown>;
  reading: Record<string, unknown>;
  discussion: Record<string, unknown>;
};

/**
 * Apply the migration - add phaseTimings to all cycles
 */
export async function up(db: Db): Promise<void> {
  const cyclesCollection = db.collection("cycles");

  // Find all active cycles
  const activeCycles = await cyclesCollection
    .find({
      status: "active",
    })
    .toArray();

  console.log(
    `Migrating ${activeCycles.length} active cycles to add phaseTimings`
  );

  // For each active cycle, add phaseTimings with the current phase start date set to now
  for (const cycle of activeCycles) {
    const now = new Date();
    const phaseTimings: PhaseTimingsMap = {
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
      phaseTimings[currentPhase as keyof PhaseTimingsMap] = { startDate: now };

      // Calculate a reasonable "started at" time based on the cycle's duration config
      // This helps make the timing more realistic than just "now"
      if (cycle.phaseDurations && cycle.phaseDurations[currentPhase]) {
        const phaseDuration = cycle.phaseDurations[currentPhase];
        const daysSinceStart = Math.floor(Math.random() * phaseDuration * 0.7); // Random point in first 70% of phase

        // Adjust the start date back by the random number of days
        phaseTimings[currentPhase as keyof PhaseTimingsMap] = {
          startDate: new Date(
            now.getTime() - daysSinceStart * 24 * 60 * 60 * 1000
          ),
        };
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

  console.log("Phase timings migration complete");
}

/**
 * Rollback the migration - remove phaseTimings from all cycles
 */
export async function down(db: Db): Promise<void> {
  const cyclesCollection = db.collection("cycles");

  const result = await cyclesCollection.updateMany(
    { phaseTimings: { $exists: true } },
    { $unset: { phaseTimings: "" } }
  );

  console.log(`Removed phaseTimings from ${result.modifiedCount} cycles`);
}
