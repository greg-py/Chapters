import { ObjectId } from "mongodb";
import { connectToDatabase } from "../db/connection";
import { getActiveCycleInChannel, createCycle, updateCycle } from "../dto";
import { DEFAULT_PHASE_DURATIONS } from "../config";
import type {
  TCycleStatus,
  TCycleStats,
  TPhaseDurations,
  TCycle,
  TCyclePhase,
} from "../models";

/**
 * Represents a book club cycle
 */
export class Cycle {
  constructor(
    private readonly id: ObjectId,
    private readonly channelId: string,
    private readonly name: string,
    private readonly startDate: Date,
    private readonly status: TCycleStatus,
    private readonly stats: TCycleStats,
    private readonly phaseDurations: TPhaseDurations,
    private readonly currentPhase: TCyclePhase
  ) {}

  /**
   * Factory method to create a new Cycle instance with default values
   */
  public static async createNew(channelId: string): Promise<Cycle> {
    const db = await connectToDatabase();

    // Check if there's already an active cycle for this channel
    const existingCycle = await getActiveCycleInChannel(db, channelId);

    if (existingCycle) {
      throw new Error(
        "An active cycle already exists for this channel. Complete the current cycle using `/chapters-complete-cycle` before starting a new one."
      );
    }

    // Set defaults for the cycle
    const date = new Date();
    const defaultCycleName = `${date.toLocaleString("default", {
      month: "long",
    })} ${date.getFullYear()}`;

    const defaultCycle: TCycle = {
      id: new ObjectId(),
      channelId,
      name: defaultCycleName,
      currentPhase: "pending",
      startDate: new Date(),
      status: "active",
      stats: {
        totalSuggestions: 0,
        totalVotes: 0,
        participantCount: 0,
      },
      phaseDurations: DEFAULT_PHASE_DURATIONS,
    };

    // Initialize the cycle in the database
    const cycleId = await createCycle(db, defaultCycle);

    return new Cycle(
      cycleId,
      defaultCycle.channelId,
      defaultCycle.name,
      defaultCycle.startDate,
      defaultCycle.status,
      defaultCycle.stats,
      defaultCycle.phaseDurations,
      defaultCycle.currentPhase
    );
  }

  /**
   * Factory method to get the active cycle for a channel
   */
  public static async getActive(channelId: string) {
    const db = await connectToDatabase();
    const cycle = await getActiveCycleInChannel(db, channelId);

    if (!cycle) {
      return null;
    }

    return new Cycle(
      cycle.id,
      cycle.channelId,
      cycle.name,
      cycle.startDate,
      cycle.status,
      cycle.stats,
      cycle.phaseDurations,
      cycle.currentPhase
    );
  }

  /**
   * Updates the current cycle properties
   */
  public async update({
    name,
    phaseDurations,
    currentPhase,
  }: {
    name?: string;
    phaseDurations?: TPhaseDurations;
    currentPhase?: TCyclePhase;
  }) {
    const db = await connectToDatabase();

    const modifiedCount = await updateCycle(db, {
      id: this.id,
      channelId: this.channelId,
      name,
      phaseDurations,
      currentPhase,
    });

    if (modifiedCount === 0) {
      throw new Error("Failed to save cycle configuration. Please try again.");
    }

    return new Cycle(
      this.id,
      this.channelId,
      name || this.name,
      this.startDate,
      this.status,
      this.stats,
      phaseDurations || this.phaseDurations,
      currentPhase || this.currentPhase
    );
  }

  public getId() {
    return this.id;
  }

  public getChannelId() {
    return this.channelId;
  }

  public getName() {
    return this.name;
  }

  public getStartDate() {
    return this.startDate;
  }

  public getStatus() {
    return this.status;
  }

  public getStats() {
    return this.stats;
  }

  public getPhaseDurations() {
    return this.phaseDurations;
  }

  public getCurrentPhase() {
    return this.currentPhase;
  }

  public getCurrentPhaseDeadline() {
    const now = new Date();
    const phase = this.currentPhase;
    const duration = this.phaseDurations[phase as keyof TPhaseDurations];

    // Convert days to milliseconds (days * 24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
    return new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
  }
}
