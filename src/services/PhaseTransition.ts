import { App } from "@slack/bolt";
import { Cycle, Suggestion, Vote } from "./";
import { CyclePhase } from "../constants";
import { capitalizeFirstLetter } from "../utils";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../db";
import { WebClient } from "@slack/web-api";

interface PhaseEndTime {
  cycleId: ObjectId;
  channelId: string;
  phase: CyclePhase;
  endTime: Date;
  attempts: number; // Track validation attempts
}

interface VoteTally {
  suggestionId: ObjectId;
  totalPoints: number;
}

/**
 * Service to manage automatic phase transitions based on configured durations
 */
export class PhaseTransitionService {
  private phaseEndTimes: Map<string, PhaseEndTime> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private client: WebClient | null = null;
  private app: App | null = null;
  private checkIntervalMs: number = 60 * 60 * 1000; // Check hourly by default
  private static instance: PhaseTransitionService | null = null;

  constructor(app: App | null, checkIntervalMinutes: number = 60) {
    this.app = app;
    this.client = app?.client || null;

    // Use a much shorter check interval if in test mode (every 10 seconds)
    if (process.env.PHASE_TEST_MODE === "true") {
      this.checkIntervalMs = 10 * 1000; // 10 seconds in test mode
      console.log(
        "🧪 TEST MODE: Phase transition checks running every 10 seconds"
      );
    } else {
      this.checkIntervalMs = checkIntervalMinutes * 60 * 1000;
    }
  }

  /**
   * Set or update the app instance
   */
  public setApp(app: App): void {
    this.app = app;
    this.client = app.client;
    console.log("Updated App instance in PhaseTransitionService");
  }

  /**
   * Get or create the singleton instance of PhaseTransitionService
   */
  public static getInstance(
    app: App | null,
    checkIntervalMinutes: number = 60
  ): PhaseTransitionService {
    if (!PhaseTransitionService.instance) {
      PhaseTransitionService.instance = new PhaseTransitionService(
        app,
        checkIntervalMinutes
      );
    } else if (app) {
      // Update the app instance if provided and instance already exists
      PhaseTransitionService.instance.setApp(app);
    }
    return PhaseTransitionService.instance;
  }

  /**
   * Start the automatic phase transition service
   */
  public start(): void {
    if (!this.app || !this.client) {
      console.warn("Cannot start PhaseTransitionService: App instance not set");
      return;
    }

    if (this.intervalId !== null) {
      console.log("Phase transition service is already running");
      return;
    }

    // Initialize phase end times for all active cycles
    this.initializePhaseEndTimes().catch((error) => {
      console.error("Error initializing phase end times:", error);
    });

    // Start interval to check for phase transitions
    this.intervalId = setInterval(() => {
      this.checkPhaseTransitions().catch((error) => {
        console.error("Error checking phase transitions:", error);
      });
    }, this.checkIntervalMs);

    console.log(
      `Phase transition service started, checking every ${
        this.checkIntervalMs / (60 * 1000)
      } minutes`
    );
  }

  /**
   * Stop the automatic phase transition service
   */
  public stop(): void {
    if (this.intervalId === null) {
      console.log("Phase transition service is not running");
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
    console.log("Phase transition service stopped");
  }

  /**
   * Initialize phase end times for all active cycles
   */
  private async initializePhaseEndTimes(): Promise<void> {
    try {
      // Clear any existing phase end times to prevent stale data
      this.phaseEndTimes.clear();

      // Get all active cycles from the database
      const db = await connectToDatabase();
      const activeCycles = await db
        .collection("cycles")
        .find({ status: "active" })
        .toArray();

      for (const cycleData of activeCycles) {
        const cycle = new Cycle(
          cycleData.id,
          cycleData.channelId,
          cycleData.name,
          cycleData.startDate,
          cycleData.status,
          cycleData.stats,
          cycleData.phaseDurations,
          cycleData.currentPhase,
          cycleData.selectedBookId
        );

        this.calculateAndSetPhaseEndTime(cycle);
      }

      console.log(
        `Initialized phase end times for ${activeCycles.length} active cycles`
      );
    } catch (error) {
      console.error("Error initializing phase end times:", error);
      throw error;
    }
  }

  /**
   * Calculate and set the phase end time for a cycle
   */
  public calculateAndSetPhaseEndTime(cycle: Cycle): void {
    const currentPhase = cycle.getCurrentPhase();
    if (currentPhase === CyclePhase.PENDING) {
      return; // Skip pending cycles
    }

    const phaseDurations = cycle.getPhaseDurations();
    const phaseDuration =
      phaseDurations[currentPhase as keyof typeof phaseDurations];

    if (!phaseDuration) {
      console.error(
        `Invalid phase duration for cycle ${cycle.getId()}, phase ${currentPhase}`
      );
      return;
    }

    // Calculate end time based on phase duration (in days)
    const now = new Date();
    const endTime = new Date(
      now.getTime() + phaseDuration * 24 * 60 * 60 * 1000
    );

    this.phaseEndTimes.set(cycle.getId().toString(), {
      cycleId: cycle.getId(),
      channelId: cycle.getChannelId(),
      phase: currentPhase as CyclePhase,
      endTime,
      attempts: 0,
    });

    // In test mode, show the end time in a more readable format
    if (process.env.PHASE_TEST_MODE === "true") {
      const seconds = Math.round((endTime.getTime() - now.getTime()) / 1000);
      console.log(
        `🧪 TEST MODE: Set phase end time for cycle ${cycle.getId()}, phase ${currentPhase}: ${endTime} (in ${seconds} seconds)`
      );
    } else {
      console.log(
        `Set phase end time for cycle ${cycle.getId()}, phase ${currentPhase}: ${endTime}`
      );
    }
  }

  /**
   * Check for and perform phase transitions for cycles past their end time
   */
  private async checkPhaseTransitions(): Promise<void> {
    // If there are no phase end times to check, skip the check
    if (this.phaseEndTimes.size === 0) {
      return;
    }

    const now = new Date();
    const phaseChangePromises: Promise<void>[] = [];

    // Clone the Map entries to avoid modification during iteration
    const entries = Array.from(this.phaseEndTimes.entries());

    for (const [cycleId, phaseInfo] of entries) {
      if (now >= phaseInfo.endTime) {
        phaseChangePromises.push(
          this.handlePhaseTransition(cycleId, phaseInfo)
        );
      }
    }

    await Promise.allSettled(phaseChangePromises);
  }

  /**
   * Handle phase transition for a specific cycle
   */
  private async handlePhaseTransition(
    cycleId: string,
    phaseInfo: PhaseEndTime
  ): Promise<void> {
    try {
      // Get the cycle by ID directly from the database
      const db = await connectToDatabase();
      const cycleData = await db
        .collection("cycles")
        .findOne({ id: phaseInfo.cycleId });

      if (!cycleData) {
        // Cycle no longer exists, remove from tracking
        this.phaseEndTimes.delete(cycleId);
        return;
      }

      const cycle = new Cycle(
        cycleData.id,
        cycleData.channelId,
        cycleData.name,
        cycleData.startDate,
        cycleData.status,
        cycleData.stats,
        cycleData.phaseDurations,
        cycleData.currentPhase,
        cycleData.selectedBookId
      );

      // Verify the cycle is still in the phase we expect
      const currentPhase = cycle.getCurrentPhase();
      if (currentPhase !== phaseInfo.phase) {
        // Phase was manually changed, recalculate end time
        this.calculateAndSetPhaseEndTime(cycle);
        return;
      }

      // Special handling for discussion phase ending - complete the cycle
      if (currentPhase === CyclePhase.DISCUSSION) {
        await this.completeCycle(cycle);
        return;
      }

      // For all other phases, continue with normal transition logic
      // Get the next phase
      const nextPhase = this.getNextPhase(currentPhase);

      // Check if the phase transition is valid
      const isValid = await this.validatePhaseTransition(cycle, nextPhase);

      if (isValid) {
        // Perform the phase transition
        await this.transitionPhase(cycle, nextPhase);
      } else {
        // Phase transition is not valid, extend the end time and notify
        this.extendPhaseEndTime(cycleId, phaseInfo);
      }
    } catch (error) {
      console.error(
        `Error handling phase transition for cycle ${cycleId}:`,
        error
      );
    }
  }

  /**
   * Validate if a phase transition is allowed
   */
  private async validatePhaseTransition(
    cycle: Cycle,
    nextPhase: CyclePhase
  ): Promise<boolean> {
    const currentPhase = cycle.getCurrentPhase();
    const suggestions = await Suggestion.getAllForCycle(cycle.getId());

    // RULE 1: If currently in suggestion phase, need at least 3 suggestions to move on
    if (
      currentPhase === CyclePhase.SUGGESTION &&
      nextPhase !== CyclePhase.SUGGESTION &&
      suggestions.length < 3
    ) {
      return false;
    }

    // RULE 2: If moving to reading or discussion phase, must have a selected book
    if (
      (nextPhase === CyclePhase.READING ||
        nextPhase === CyclePhase.DISCUSSION) &&
      !cycle.getSelectedBookId()
    ) {
      // If in voting phase, could try to auto-select the winning book
      if (currentPhase === CyclePhase.VOTING) {
        // Try to automatically select the winner
        return await this.autoSelectWinner(cycle);
      }
      return false;
    }

    return true;
  }

  /**
   * Auto-select the winning book based on votes
   */
  private async autoSelectWinner(cycle: Cycle): Promise<boolean> {
    try {
      const suggestions = await Suggestion.getAllForCycle(cycle.getId());

      // Need at least some suggestions to select a winner
      if (suggestions.length === 0) {
        return false;
      }

      // Count voters who have cast votes
      const voterSet = new Set<string>();
      suggestions.forEach((suggestion) => {
        const voters = suggestion.getVoters();
        voters.forEach((voter) => voterSet.add(voter));
      });

      // Need at least some votes to select a winner
      if (voterSet.size === 0) {
        return false;
      }

      // Tally the votes
      const voteTallies = this.tallyVotesForCycle(suggestions);

      if (voteTallies.length === 0) {
        return false;
      }

      // Find the winner (first place in ranked choice voting)
      const winningBookId = voteTallies[0].suggestionId;
      const winnerSuggestion = suggestions.find(
        (s) => s.getId().toString() === winningBookId.toString()
      );

      if (!winnerSuggestion) {
        return false;
      }

      // Update the cycle with the selected book
      await cycle.update({
        selectedBookId: winningBookId,
      });

      return true;
    } catch (error) {
      console.error("Error auto-selecting winner:", error);
      return false;
    }
  }

  /**
   * Tally votes for a cycle based on suggestions
   */
  private tallyVotesForCycle(suggestions: Suggestion[]): VoteTally[] {
    // Sort suggestions by their total points in descending order
    const tallies = suggestions
      .map((suggestion) => ({
        suggestionId: suggestion.getId(),
        totalPoints: suggestion.getTotalPoints() || 0,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return tallies;
  }

  /**
   * Count the number of users who have voted in a cycle
   */
  private countVotesForCycle(suggestions: Suggestion[]): number {
    const voterSet = new Set<string>();

    suggestions.forEach((suggestion) => {
      const voters = suggestion.getVoters();
      voters.forEach((voter) => voterSet.add(voter));
    });

    return voterSet.size;
  }

  /**
   * Transition a cycle to the next phase
   */
  private async transitionPhase(
    cycle: Cycle,
    nextPhase: CyclePhase
  ): Promise<void> {
    if (!this.client) {
      console.error("Cannot transition phase: client is null");
      return;
    }

    const currentPhase = cycle.getCurrentPhase();
    const channelId = cycle.getChannelId();

    // RULE 3: If moving back to suggestion phase, clear selected book and votes
    let updateData: {
      currentPhase: CyclePhase;
      selectedBookId?: null;
    } = { currentPhase: nextPhase };

    let announcementMsg = `:rotating_light: *Automatic Book Club Phase Change*\n\nThe "${cycle.getName()}" book club cycle has moved to the *${capitalizeFirstLetter(
      nextPhase
    )} Phase*.`;

    if (
      nextPhase === CyclePhase.SUGGESTION &&
      (currentPhase === CyclePhase.VOTING ||
        currentPhase === CyclePhase.READING ||
        currentPhase === CyclePhase.DISCUSSION)
    ) {
      // Clear the selected book
      updateData.selectedBookId = null;

      // Reset all votes for the cycle
      await Vote.resetVotesForCycle(cycle.getId());

      // Add to announcement
      announcementMsg += `\n\nThis is a reset back to the suggestion phase. Any previously selected book has been cleared and all votes have been reset, but existing suggestions remain. Members can now suggest additional books using \`/chapters-suggest-book\`.`;
    }

    // If transitioning to VOTING phase, include all suggested books
    if (nextPhase === CyclePhase.VOTING) {
      const suggestions = await Suggestion.getAllForCycle(cycle.getId());

      if (suggestions.length > 0) {
        announcementMsg += `\n\n:ballot_box_with_ballot: *Books Available for Voting:*\n`;

        // Add each book to the message with formatting
        suggestions.forEach((suggestion, index) => {
          announcementMsg += `\n${
            index + 1
          }. *"${suggestion.getBookName()}"* by *${suggestion.getAuthor()}*`;
        });

        announcementMsg += `\n\nUse \`/chapters-vote\` to cast your vote for these books!`;
      } else {
        announcementMsg += `\n\nNo books have been suggested for this cycle. This is unusual - please use \`/chapters-suggest-book\` to add suggestions.`;
      }
    }

    // If transitioning to READING phase, show the winning book with nice formatting
    if (nextPhase === CyclePhase.READING) {
      // First, make sure we have a selected book
      let selectedBookId = cycle.getSelectedBookId();

      // If no book is selected yet, try to auto-select a winner
      if (!selectedBookId) {
        const success = await this.autoSelectWinner(cycle);
        if (success) {
          // Get the updated cycle with the newly selected book
          const db = await connectToDatabase();
          const updatedCycleData = await db
            .collection("cycles")
            .findOne({ id: cycle.getId() });

          if (updatedCycleData && updatedCycleData.selectedBookId) {
            selectedBookId = updatedCycleData.selectedBookId;
          }
        }
      }

      // Now process the message with the book info if we have it
      if (selectedBookId) {
        const selectedBook = await Suggestion.getById(selectedBookId);
        if (selectedBook) {
          // Enhanced formatted message for the winning book
          announcementMsg += `\n\n:trophy: *Selected Book* :trophy:\n\n`;
          announcementMsg += `> :book: *"${selectedBook.getBookName()}"*\n`;
          announcementMsg += `> :writing_hand: by *${selectedBook.getAuthor()}*\n`;

          // Add link if available
          const bookLink = selectedBook.getLink();
          if (bookLink) {
            announcementMsg += `> :link: <${bookLink}|View Book Details>\n`;
          }

          // Add notes if available
          const bookNotes = selectedBook.getNotes();
          if (bookNotes) {
            announcementMsg += `> :memo: ${bookNotes}\n`;
          }

          announcementMsg += `\n*Happy Reading!* :sparkles:`;
        }
      } else {
        announcementMsg += `\n\nNo book was selected for this cycle. This is unusual - please manually select a book using the book club management commands.`;
      }
    }

    // If transitioning to DISCUSSION phase, add congratulations and instructions
    if (nextPhase === CyclePhase.DISCUSSION) {
      const selectedBookId = cycle.getSelectedBookId();
      if (selectedBookId) {
        const selectedBook = await Suggestion.getById(selectedBookId);
        if (selectedBook) {
          announcementMsg += `\n\n:tada: *Congratulations on finishing "${selectedBook.getBookName()}"!* :tada:\n\n`;
          announcementMsg += `It's time to discuss what you thought about the book! Please use the *Discussion* channel to share your questions, thoughts, and opinions about "${selectedBook.getBookName()}" by ${selectedBook.getAuthor()}.`;
          announcementMsg += `\n\nSome discussion prompts to get started:\n• What did you like most about the book?\n• Were there any characters or moments that particularly stood out to you?\n• Would you recommend this book to others?`;
        } else {
          announcementMsg += `\n\n:tada: *Congratulations on finishing your book!* :tada:\n\n`;
          announcementMsg += `It's time to discuss what you thought about it! Please use the *Discussion* channel to share your questions, thoughts, and opinions about this cycle's book.`;
        }
      } else {
        announcementMsg += `\n\n:tada: *Congratulations on finishing your book!* :tada:\n\n`;
        announcementMsg += `It's time to discuss what you thought about it! Please use the *Discussion* channel to share your questions, thoughts, and opinions about this cycle's book.`;
      }
    }

    // Get phase duration for the announcement
    const phaseDurations = cycle.getPhaseDurations();
    const duration = phaseDurations[nextPhase as keyof typeof phaseDurations];

    // Show "1 minute" in test mode instead of fractional days
    if (process.env.PHASE_TEST_MODE === "true") {
      announcementMsg += `\n\nThis phase will end in 1 minute.`;
    } else {
      announcementMsg += `\n\nThis phase will end in ${duration} days.`;
    }

    // Update the cycle
    const updatedCycle = await cycle.update(updateData);

    // Post announcement in the channel
    await this.client.chat.postMessage({
      channel: channelId,
      text: announcementMsg,
    });

    // Recalculate the end time for the new phase
    this.calculateAndSetPhaseEndTime(updatedCycle);

    console.log(
      `Cycle ${cycle.getId()} automatically transitioned from ${currentPhase} to ${nextPhase}`
    );
  }

  /**
   * Extend the phase end time by one day after failed validation
   */
  private extendPhaseEndTime(cycleId: string, phaseInfo: PhaseEndTime): void {
    const currentAttempts = phaseInfo.attempts + 1;

    // Extend by one minute in test mode, otherwise one day
    const extensionMs =
      process.env.PHASE_TEST_MODE === "true"
        ? 60 * 1000 // 1 minute in test mode
        : 24 * 60 * 60 * 1000; // 1 day in normal mode

    const newEndTime = new Date(phaseInfo.endTime.getTime() + extensionMs);

    this.phaseEndTimes.set(cycleId, {
      ...phaseInfo,
      endTime: newEndTime,
      attempts: currentAttempts,
    });

    // Notify in the channel if necessary
    this.notifyExtendedDeadline(phaseInfo, newEndTime, currentAttempts).catch(
      (error) => {
        console.error(
          `Error notifying extended deadline for cycle ${cycleId}:`,
          error
        );
      }
    );

    // Log with appropriate time unit
    const extensionUnit =
      process.env.PHASE_TEST_MODE === "true" ? "minute" : "day";
    console.log(
      `Extended phase end time for cycle ${cycleId} to ${newEndTime} (by 1 ${extensionUnit})`
    );
  }

  /**
   * Send a notification that the phase deadline has been extended
   */
  private async notifyExtendedDeadline(
    phaseInfo: PhaseEndTime,
    newEndTime: Date,
    attempts: number
  ): Promise<void> {
    if (!this.client) {
      console.error("Cannot notify extended deadline: client is null");
      return;
    }

    // In test mode, notify on every attempt. In normal mode, only on 1st, 3rd, 7th day, etc.
    if (
      process.env.PHASE_TEST_MODE !== "true" &&
      attempts !== 1 &&
      attempts !== 3 &&
      attempts !== 7 &&
      attempts % 7 !== 0
    ) {
      return;
    }

    try {
      // Get the cycle directly from the database
      const db = await connectToDatabase();
      const cycleData = await db
        .collection("cycles")
        .findOne({ id: phaseInfo.cycleId });

      if (!cycleData) return;

      const cycle = new Cycle(
        cycleData.id,
        cycleData.channelId,
        cycleData.name,
        cycleData.startDate,
        cycleData.status,
        cycleData.stats,
        cycleData.phaseDurations,
        cycleData.currentPhase,
        cycleData.selectedBookId
      );

      const extensionUnit =
        process.env.PHASE_TEST_MODE === "true" ? "minute" : "day";

      let message = `:clock1: *Book Club Phase Change Delayed*\n\nThe ${capitalizeFirstLetter(
        phaseInfo.phase
      )} phase for cycle "${cycle.getName()}" has been extended by another ${extensionUnit}.`;

      // Explain why based on current phase
      if (phaseInfo.phase === CyclePhase.SUGGESTION) {
        message += `\n\nReason: At least 3 book suggestions are required before moving to the next phase. Use \`/chapters-suggest-book\` to add suggestions.`;
      } else if (phaseInfo.phase === CyclePhase.VOTING) {
        message += `\n\nReason: More votes are needed to select a book. Use \`/chapters-vote\` to cast your vote.`;
      }

      message += `\n\nThe phase will now end on ${newEndTime.toLocaleDateString()}`;

      // Add more precise time in test mode
      if (process.env.PHASE_TEST_MODE === "true") {
        message += ` at ${newEndTime.toLocaleTimeString()}`;
      }

      message += ` if requirements are met.`;

      await this.client.chat.postMessage({
        channel: phaseInfo.channelId,
        text: message,
      });
    } catch (error) {
      console.error("Error sending deadline extension notification:", error);
    }
  }

  /**
   * Determine the next phase in the cycle sequence
   */
  private getNextPhase(currentPhase: string): CyclePhase {
    switch (currentPhase) {
      case CyclePhase.PENDING:
        return CyclePhase.SUGGESTION;
      case CyclePhase.SUGGESTION:
        return CyclePhase.VOTING;
      case CyclePhase.VOTING:
        return CyclePhase.READING;
      case CyclePhase.READING:
        return CyclePhase.DISCUSSION;
      case CyclePhase.DISCUSSION:
        // For discussion phase, we'll handle completion differently
        // but still need to return a value for other functions
        return CyclePhase.SUGGESTION;
      default:
        return CyclePhase.SUGGESTION;
    }
  }

  /**
   * Update tracking when a cycle's configuration changes
   */
  public onCycleUpdated(cycle: Cycle): void {
    this.calculateAndSetPhaseEndTime(cycle);
  }

  /**
   * Register for a new cycle creation
   */
  public onNewCycle(cycle: Cycle): void {
    // Clear any existing data for this channel's cycle to avoid conflicts
    // First, find any existing entry for this channel ID
    const existingEntries = Array.from(this.phaseEndTimes.entries()).filter(
      ([_, info]) => info.channelId === cycle.getChannelId()
    );

    // Remove any existing entries for this channel
    for (const [existingCycleId] of existingEntries) {
      this.phaseEndTimes.delete(existingCycleId);
    }

    // Calculate and set the phase end time for the new cycle
    this.calculateAndSetPhaseEndTime(cycle);
  }

  /**
   * Remove a cycle from tracking when it's completed
   */
  public onCycleCompleted(channelId: string): void {
    // Find any existing entry for this channel ID
    const existingEntries = Array.from(this.phaseEndTimes.entries()).filter(
      ([_, info]) => info.channelId === channelId
    );

    // Remove any existing entries for this channel
    for (const [existingCycleId] of existingEntries) {
      this.phaseEndTimes.delete(existingCycleId);
    }

    console.log(`Removed completed cycle tracking for channel ${channelId}`);
  }

  /**
   * Manually trigger phase transition check (for testing)
   */
  public async triggerCheck(): Promise<void> {
    await this.checkPhaseTransitions();
  }

  /**
   * Complete a cycle at the end of the discussion phase
   */
  private async completeCycle(cycle: Cycle): Promise<void> {
    if (!this.client) {
      console.error("Cannot complete cycle: client is null");
      return;
    }

    try {
      const channelId = cycle.getChannelId();

      // Update cycle status to completed
      await cycle.update({ status: "completed" });

      // Post announcement in the channel
      await this.client.chat.postMessage({
        channel: channelId,
        text: `:tada: *Book Club Cycle Completed!*\n\nThe book club cycle "${cycle.getName()}" has been completed and archived.\n\nTo start a new book club cycle, use the \`/chapters-start-cycle\` command.`,
      });

      // Remove the cycle from tracking
      this.onCycleCompleted(channelId);

      console.log(
        `Cycle ${cycle.getId()} automatically completed after discussion phase`
      );
    } catch (error) {
      console.error(`Error completing cycle: ${error}`);
    }
  }
}
