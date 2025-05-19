import { App } from "@slack/bolt";
import { Cycle, Suggestion } from "./";
import { CyclePhase } from "../constants";
import { capitalizeFirstLetter } from "../utils";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../db";
import { WebClient } from "@slack/web-api";
import { getAllActiveCycles, getCycleById } from "../dto";

interface VoteTally {
  suggestionId: ObjectId;
  totalPoints: number;
}

/**
 * Service to manage automatic phase transitions based on configured durations
 */
export class PhaseTransitionService {
  private intervalId: NodeJS.Timeout | null = null;
  private client: WebClient | null = null;
  private app: App | null = null;
  private checkIntervalMs: number = 60 * 60 * 1000; // Check hourly by default
  private static instance: PhaseTransitionService | null = null;

  constructor(app: App | null, checkIntervalMinutes: number = 60) {
    this.app = app;
    if (app) {
      this.client = app.client;
    }

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
   * Check for and perform phase transitions for cycles past their end time
   */
  private async checkPhaseTransitions(): Promise<void> {
    try {
      // Get all active cycles using the DTO function
      const db = await connectToDatabase();
      const activeCycles = await getAllActiveCycles(db);

      if (activeCycles.length === 0) {
        return;
      }

      const now = new Date();
      const phaseChangePromises: Promise<void>[] = [];

      for (const cycleData of activeCycles) {
        const cycle = new Cycle(
          cycleData._id,
          cycleData.channelId,
          cycleData.name,
          cycleData.startDate,
          cycleData.status,
          cycleData.phaseDurations,
          cycleData.currentPhase,
          cycleData.selectedBookId,
          cycleData.phaseTimings
        );

        // Skip pending cycles
        if (cycle.getCurrentPhase() === CyclePhase.PENDING) {
          continue;
        }

        // If the phase has no start date, set it now
        if (!cycle.getCurrentPhaseStartDate()) {
          await cycle.setCurrentPhaseStartDate();
          continue;
        }

        // Calculate when the phase should end based on the start date and duration
        const calculatedEndDate = cycle.calculateCurrentPhaseEndDate();

        // If there's no calculated end date, skip
        if (!calculatedEndDate) {
          continue;
        }

        // Check for notification windows
        await this.checkNotificationWindows(cycle, calculatedEndDate, now);

        // If the calculated end date has passed, transition the phase
        if (now >= calculatedEndDate) {
          phaseChangePromises.push(this.handlePhaseTransition(cycle));
        }
      }

      await Promise.allSettled(phaseChangePromises);
    } catch (error) {
      console.error("Error checking phase transitions:", error);
    }
  }

  /**
   * Check if we should send deadline notifications
   */
  private async checkNotificationWindows(
    cycle: Cycle,
    endDate: Date,
    now: Date
  ): Promise<void> {
    if (!this.client) {
      console.error("Cannot send notifications: client is null");
      return;
    }

    const currentPhase = cycle.getCurrentPhase();
    const phaseTimings = cycle.getPhaseTimings();

    // Skip if we're in pending/discussion phase or if phaseTimings is undefined
    if (
      currentPhase === CyclePhase.PENDING ||
      currentPhase === CyclePhase.DISCUSSION ||
      !phaseTimings
    ) {
      return;
    }

    const phaseTiming = phaseTimings[currentPhase as keyof typeof phaseTimings];
    if (!phaseTiming) {
      return;
    }

    const timeUntilEnd = endDate.getTime() - now.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;

    // Determine the notification window based on the phase
    const notificationWindow =
      currentPhase === CyclePhase.READING ? sevenDaysMs : oneDayMs;
    const windowLabel =
      currentPhase === CyclePhase.READING ? "seven days" : "one day";

    // Check if we're in the notification window
    // For reading phase: between 7-8 days remaining
    // For other phases: between 1-2 days remaining
    if (
      timeUntilEnd <= notificationWindow &&
      timeUntilEnd > notificationWindow - this.checkIntervalMs
    ) {
      // Only send notification if there hasn't been a deadline extension
      // and we haven't already sent it
      if (
        !phaseTiming.extended &&
        !(
          "deadlineNotificationSent" in phaseTiming &&
          phaseTiming.deadlineNotificationSent
        )
      ) {
        await this.sendDeadlineNotification(cycle, windowLabel);
        // Mark that we've sent the notification
        await cycle.update({
          phaseTimings: {
            ...phaseTimings,
            [currentPhase]: {
              ...phaseTiming,
              deadlineNotificationSent: true,
            },
          },
        });
      }
    }
  }

  /**
   * Send a deadline notification to the channel
   */
  private async sendDeadlineNotification(
    cycle: Cycle,
    timeWindow: string
  ): Promise<void> {
    if (!this.client) {
      console.error("Cannot send deadline notification: client is null");
      return;
    }

    const channelId = cycle.getChannelId();
    const currentPhase = cycle.getCurrentPhase();
    let message = `:warning: *Book Club Phase Deadline Reminder*\n\n`;
    message += `The "${cycle.getName()}" book club cycle has ${timeWindow} remaining in the *${capitalizeFirstLetter(
      currentPhase
    )} Phase*.`;

    // Add phase-specific instructions
    switch (currentPhase) {
      case CyclePhase.SUGGESTION:
        message += `\n\nPlease use \`/chapters-suggest-book\` to add your book suggestions if you haven't already.`;
        break;
      case CyclePhase.VOTING:
        message += `\n\nPlease use \`/chapters-vote\` to cast your vote if you haven't already.`;
        break;
      case CyclePhase.READING:
        message += `\n\nPlease make sure you're on track to finish the book before the discussion phase begins.`;
        break;
    }

    // Post notification in the channel
    await this.client.chat.postMessage({
      channel: channelId,
      text: message,
    });

    console.log(
      `Sent ${timeWindow} deadline notification for cycle ${cycle.getId()} in ${currentPhase} phase`
    );
  }

  /**
   * Handle phase transition for a specific cycle
   */
  private async handlePhaseTransition(cycle: Cycle): Promise<void> {
    try {
      const currentPhase = cycle.getCurrentPhase();

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
        // Phase transition is not valid, notify about the issue
        await this.notifyInvalidTransition(cycle, nextPhase);
      }
    } catch (error) {
      console.error(
        `Error handling phase transition for cycle ${cycle.getId()}:`,
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
      const winnerSuggestion = suggestions.find((s) =>
        s.getId().equals(winningBookId)
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
   * Perform a phase transition
   */
  private async transitionPhase(
    cycle: Cycle,
    nextPhase: CyclePhase
  ): Promise<void> {
    try {
      // Set the end date for the current phase
      await cycle.setCurrentPhaseEndDate();

      // Update the cycle to the new phase
      const updatedCycle = await cycle.update({ currentPhase: nextPhase });

      // Set the start date for the new phase
      await updatedCycle.setCurrentPhaseStartDate();

      // Notify the channel about the phase transition
      await this.notifyPhaseTransition(cycle, nextPhase);

      console.log(
        `Auto-transitioned cycle ${cycle.getId()} from ${cycle.getCurrentPhase()} to ${nextPhase}`
      );
    } catch (error) {
      console.error("Error transitioning phase:", error);
    }
  }

  /**
   * Notify the channel about a phase transition
   */
  private async notifyPhaseTransition(
    cycle: Cycle,
    nextPhase: CyclePhase
  ): Promise<void> {
    if (!this.client) {
      console.error("Cannot notify phase transition: client is null");
      return;
    }

    const channelId = cycle.getChannelId();
    let announcementMsg = `:rotating_light: *Automatic Book Club Phase Change*\n\nThe "${cycle.getName()}" book club cycle has moved to the *${capitalizeFirstLetter(
      nextPhase
    )} Phase*.`;

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
          // Get the updated cycle with the newly selected book using the DTO function
          const db = await connectToDatabase();
          const updatedCycleData = await getCycleById(db, cycle.getId());

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

    // Post announcement in the channel
    await this.client.chat.postMessage({
      channel: channelId,
      text: announcementMsg,
    });

    // Log the transition
    console.log(
      `Cycle ${cycle.getId()} automatically transitioned from ${cycle.getCurrentPhase()} to ${nextPhase}`
    );
  }

  /**
   * Notify the channel about a failed phase transition
   */
  private async notifyInvalidTransition(
    cycle: Cycle,
    attemptedPhase: CyclePhase
  ): Promise<void> {
    if (!this.client) {
      console.error("Cannot notify invalid transition: client is null");
      return;
    }

    const channelId = cycle.getChannelId();
    let message = `:rotating_light: *Automatic Book Club Phase Change*\n\nThe "${cycle.getName()}" book club cycle has encountered an issue with the phase transition.`;

    // Explain why based on current phase
    if (attemptedPhase === CyclePhase.SUGGESTION) {
      message += `\n\nReason: At least 3 book suggestions are required before moving to the next phase. Use \`/chapters-suggest-book\` to add suggestions.`;
    } else if (attemptedPhase === CyclePhase.VOTING) {
      message += `\n\nReason: More votes are needed to select a book. Use \`/chapters-vote\` to cast your vote.`;
    }

    message += `\n\nThe cycle will now remain in the ${capitalizeFirstLetter(
      cycle.getCurrentPhase()
    )} phase.`;

    // Post notification in the channel
    await this.client.chat.postMessage({
      channel: channelId,
      text: message,
    });

    console.log(
      `Cycle ${cycle.getId()} failed to transition from ${cycle.getCurrentPhase()} to ${attemptedPhase}`
    );
  }

  /**
   * Get the next phase in the sequence
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
        return CyclePhase.DISCUSSION; // No next phase, remains in discussion
      default:
        return CyclePhase.PENDING;
    }
  }

  /**
   * Manually trigger phase transition check (for testing)
   */
  public async triggerCheck(): Promise<void> {
    await this.checkPhaseTransitions();
  }

  /**
   * Complete a cycle
   */
  private async completeCycle(cycle: Cycle): Promise<void> {
    try {
      // Set the end date for the discussion phase
      await cycle.setCurrentPhaseEndDate();

      // Update the cycle status to completed
      await cycle.update({ status: "completed" });

      // Notify the channel about cycle completion
      await this.notifyCycleCompletion(cycle);

      console.log(`Auto-completed cycle ${cycle.getId()}`);
    } catch (error) {
      console.error("Error completing cycle:", error);
    }
  }

  /**
   * Notify the channel about a cycle completion
   */
  private async notifyCycleCompletion(cycle: Cycle): Promise<void> {
    if (!this.client) {
      console.error("Cannot notify cycle completion: client is null");
      return;
    }

    const channelId = cycle.getChannelId();
    await this.client.chat.postMessage({
      channel: channelId,
      text: `:tada: *Book Club Cycle Completed!*\n\nThe book club cycle "${cycle.getName()}" has been completed and archived.\n\nTo start a new book club cycle, use the \`/chapters-start-cycle\` command.`,
    });

    console.log(`Cycle ${cycle.getId()} completed and archived`);
  }

  /**
   * Tally votes for a cycle
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
}
