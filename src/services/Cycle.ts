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
  TPhaseDurations,
  TPhaseTimings,
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
    private readonly phaseDurations: TPhaseDurations,
    private readonly currentPhase: TCyclePhase,
    private readonly selectedBookId?: ObjectId,
    private readonly phaseTimings?: TPhaseTimings
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
      cycle.phaseDurations,
      cycle.currentPhase,
      cycle.selectedBookId,
      cycle.phaseTimings
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
    phaseTimings,
  }: {
    name?: string;
    phaseDurations?: TPhaseDurations;
    currentPhase?: TCyclePhase;
    selectedBookId?: ObjectId | null;
    status?: TCycleStatus;
    phaseTimings?: TPhaseTimings;
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
      phaseTimings?: TPhaseTimings;
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
    if (phaseTimings !== undefined) updateData.phaseTimings = phaseTimings;
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
      phaseDurations || this.phaseDurations,
      currentPhase || this.currentPhase,
      updatedSelectedBookId,
      phaseTimings || this.phaseTimings
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
      participantCount: allVoters.size, // Align participantCount with totalVotes
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

  public getPhaseTimings() {
    return this.phaseTimings;
  }

  /**
   * Get current phase's start date
   */
  public getCurrentPhaseStartDate(): Date | undefined {
    if (!this.phaseTimings) return undefined;
    return this.phaseTimings[this.currentPhase as keyof TPhaseTimings]
      ?.startDate;
  }

  /**
   * Get current phase's end date
   */
  public getCurrentPhaseEndDate(): Date | undefined {
    if (!this.phaseTimings) return undefined;
    return this.phaseTimings[this.currentPhase as keyof TPhaseTimings]?.endDate;
  }

  /**
   * Calculate the expected end date for the current phase
   * based on the stored start date and phase duration
   */
  public calculateCurrentPhaseEndDate(): Date | undefined {
    const startDate = this.getCurrentPhaseStartDate();
    if (!startDate) return undefined;

    const phaseDurations = this.phaseDurations;
    const duration = phaseDurations[this.currentPhase as keyof TPhaseDurations];

    // Convert days to milliseconds (days * 24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
    return new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
  }

  /**
   * @deprecated Use getCurrentPhaseEndDate() instead
   * This method is kept for backward compatibility
   */
  public getCurrentPhaseDeadline() {
    // First try to use the persisted end date
    const endDate = this.getCurrentPhaseEndDate();
    if (endDate) return endDate;

    // Fall back to the old calculation method if no persisted end date exists
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

  /**
   * Set the start date for the current phase, marking when it began
   */
  public async setCurrentPhaseStartDate(): Promise<Cycle> {
    const now = new Date();

    // Create a new phase timings object or use existing one
    const phaseTimings = this.phaseTimings
      ? { ...this.phaseTimings }
      : {
          suggestion: {},
          voting: {},
          reading: {},
          discussion: {},
        };

    // Update the start date for the current phase
    const phase = this.currentPhase as keyof TPhaseTimings;
    phaseTimings[phase] = {
      ...phaseTimings[phase],
      startDate: now,
    };

    // Update the cycle with the new phase timings
    return this.update({ phaseTimings });
  }

  /**
   * Set the end date for the current phase, marking when it completed
   */
  public async setCurrentPhaseEndDate(): Promise<Cycle> {
    const now = new Date();

    // Create a new phase timings object or use existing one
    const phaseTimings = this.phaseTimings
      ? { ...this.phaseTimings }
      : {
          suggestion: {},
          voting: {},
          reading: {},
          discussion: {},
        };

    // Update the end date for the current phase
    const phase = this.currentPhase as keyof TPhaseTimings;
    phaseTimings[phase] = {
      ...phaseTimings[phase],
      endDate: now,
    };

    // Update the cycle with the new phase timings
    return this.update({ phaseTimings });
  }
}
