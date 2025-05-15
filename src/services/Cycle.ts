import { ObjectId } from "mongodb";
import { connectToDatabase } from "../db";
import {
  getActiveCycleInChannel,
  createCycle,
  updateCycle,
  getSuggestionsByCycle,
} from "../dto";
import { getPhaseConfig } from "../config";
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
    private readonly currentPhase: TCyclePhase,
    private readonly selectedBookId?: ObjectId
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
      _id: new ObjectId(),
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
      phaseDurations: getPhaseConfig(),
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
      cycle._id!,
      cycle.channelId,
      cycle.name,
      cycle.startDate,
      cycle.status,
      cycle.stats,
      cycle.phaseDurations,
      cycle.currentPhase,
      cycle.selectedBookId
    );
  }

  /**
   * Updates the current cycle properties
   */
  public async update({
    name,
    phaseDurations,
    currentPhase,
    selectedBookId,
    status,
  }: {
    name?: string;
    phaseDurations?: TPhaseDurations;
    currentPhase?: TCyclePhase;
    selectedBookId?: ObjectId | null;
    status?: TCycleStatus;
  }) {
    const db = await connectToDatabase();

    // Create an update object that only includes properties that are defined
    const updateData: {
      _id: ObjectId;
      channelId: string;
      name?: string;
      phaseDurations?: TPhaseDurations;
      currentPhase?: TCyclePhase;
      selectedBookId?: ObjectId | undefined;
      status?: TCycleStatus;
    } = {
      _id: this.id,
      channelId: this.channelId,
    };

    // Only add properties that are defined
    if (name !== undefined && name !== this.name && name.trim() !== "")
      updateData.name = name;
    if (phaseDurations !== undefined)
      updateData.phaseDurations = phaseDurations;
    if (currentPhase !== undefined && currentPhase !== this.currentPhase)
      updateData.currentPhase = currentPhase;
    if (status !== undefined && status !== this.status)
      updateData.status = status;
    if (selectedBookId !== undefined) {
      if (selectedBookId === null) {
        // To clear the selected book, use $unset in MongoDB
        // This is handled in the updateCycle function
        updateData.selectedBookId = undefined;
      } else {
        updateData.selectedBookId = selectedBookId;
      }
    }

    const modifiedCount = await updateCycle(db, updateData);

    if (modifiedCount === 0) {
      throw new Error("Failed to save cycle configuration. Please try again.");
    }

    let updatedSelectedBookId = this.selectedBookId;
    if (selectedBookId !== undefined) {
      updatedSelectedBookId =
        selectedBookId === null ? undefined : selectedBookId;
    }

    return new Cycle(
      this.id,
      this.channelId,
      name || this.name,
      this.startDate,
      status || this.status,
      this.stats,
      phaseDurations || this.phaseDurations,
      currentPhase || this.currentPhase,
      updatedSelectedBookId
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

  public async getStats() {
    const db = await connectToDatabase();
    const suggestions = await getSuggestionsByCycle(db, this.id);

    // Count unique voters across all suggestions
    const allVoters = new Set<string>();
    suggestions.forEach((suggestion) => {
      if (suggestion.voters && Array.isArray(suggestion.voters)) {
        suggestion.voters.forEach((voter) => allVoters.add(voter));
      }
    });

    return {
      totalSuggestions: suggestions.length,
      totalVotes: allVoters.size,
    };
  }

  public getPhaseDurations() {
    return this.phaseDurations;
  }

  public getCurrentPhase() {
    return this.currentPhase;
  }

  public getSelectedBookId() {
    return this.selectedBookId;
  }

  public getCurrentPhaseDeadline() {
    const now = new Date();
    const phase = this.currentPhase;

    // Add null check and fallback to default durations
    const phaseDurations = this.phaseDurations || getPhaseConfig();
    const duration =
      phaseDurations[phase as keyof TPhaseDurations] ||
      getPhaseConfig()[phase as keyof ReturnType<typeof getPhaseConfig>] ||
      7; // Default to 7 days if all else fails

    // Convert days to milliseconds (days * 24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
    return new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
  }
}
