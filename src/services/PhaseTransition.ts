import { App } from "@slack/bolt";
import { Cycle, Suggestion } from "./";
import { CyclePhase } from "../constants";
import { capitalizeFirstLetter, resolveTiesAndSelectWinner } from "../utils";
import { connectToDatabase } from "../db";
import { WebClient } from "@slack/web-api";
import { getAllActiveCycles, getCycleById } from "../dto";

/**
 * Service to manage automatic phase transitions based on configured durations
 * This service can be run either via continuous interval (local) or
 * via Vercel CRON jobs (production)
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
    } else if (process.env.SLACK_APP_BOT_TOKEN) {
      // Initialize WebClient directly if we have a token but no app
      // This is necessary for serverless environments like Vercel CRON
      this.client = new WebClient(process.env.SLACK_APP_BOT_TOKEN);
      console.log("Initialized WebClient directly for serverless execution");
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
   * Set the WebClient instance directly
   * This is useful for serverless environments
   */
  public setWebClient(client: WebClient): void {
    this.client = client;
    console.log("Updated WebClient instance in PhaseTransitionService");
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
   * Initialize WebClient if not already set.
   * This is important for serverless environments where the client might not be initialized.
   */
  private ensureClient(): boolean {
    if (!this.client && process.env.SLACK_APP_BOT_TOKEN) {
      this.client = new WebClient(process.env.SLACK_APP_BOT_TOKEN);
      console.log("Initialized WebClient on-demand for serverless execution");
      return true;
    }
    return !!this.client;
  }

  /**
   * Get the initialized client or throw an error
   */
  private getClient(): WebClient {
    if (!this.client) {
      if (!this.ensureClient()) {
        throw new Error("Failed to initialize Slack client");
      }
    }
    return this.client!;
  }

  /**
   * Start the automatic phase transition service
   * This is used for continuous checking in non-serverless environments
   */
  public start(): void {
    if (!this.ensureClient()) {
      console.warn(
        "Cannot start PhaseTransitionService: Unable to initialize Slack client"
      );
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
      console.log("🔄 Running phase transition check...");

      // Get all active cycles using the DTO function
      const db = await connectToDatabase();
      const activeCycles = await getAllActiveCycles(db);

      console.log(`📚 Found ${activeCycles.length} active cycles`);

      if (activeCycles.length === 0) {
        return;
      }

      const now = new Date();
      console.log(`⏰ Current time: ${now.toISOString()}`);

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

        console.log(
          `\n🔍 Checking cycle: ${cycle.getName()} (${cycle.getId()})`
        );
        console.log(`  • Current phase: ${cycle.getCurrentPhase()}`);

        // Skip pending cycles
        if (cycle.getCurrentPhase() === CyclePhase.PENDING) {
          console.log(`  • Skipping: Cycle is in PENDING phase`);
          continue;
        }

        // If the phase has no start date, set it now
        if (!cycle.getCurrentPhaseStartDate()) {
          console.log(
            `  • Setting start date for phase: ${cycle.getCurrentPhase()}`
          );
          await cycle.setCurrentPhaseStartDate();
          continue;
        }

        // Check if we're in the VOTING phase and all members have voted
        if (cycle.getCurrentPhase() === CyclePhase.VOTING) {
          console.log(`  • Checking if all channel members have voted...`);
          const allMembersVoted = await this.haveAllChannelMembersVoted(cycle);

          if (allMembersVoted) {
            console.log(
              `  • 🎉 All channel members have voted, transitioning to reading phase...`
            );
            phaseChangePromises.push(this.handlePhaseTransition(cycle));
            continue;
          } else {
            console.log(`  • Some channel members haven't voted yet`);
          }
        }

        const phaseStartDate = cycle.getCurrentPhaseStartDate();
        console.log(`  • Phase start date: ${phaseStartDate?.toISOString()}`);

        // Get the duration for the current phase
        const phaseDurations = cycle.getPhaseDurations();
        const currentPhaseKey =
          cycle.getCurrentPhase() as keyof typeof phaseDurations;
        const phaseDuration = phaseDurations[currentPhaseKey];
        console.log(`  • Phase duration: ${phaseDuration} days`);

        // Calculate the expected end date directly from start date + duration
        if (phaseStartDate) {
          const expectedEndDate = new Date(phaseStartDate);

          // In test mode, use minutes instead of days
          if (process.env.PHASE_TEST_MODE === "true") {
            expectedEndDate.setMinutes(
              expectedEndDate.getMinutes() + phaseDuration
            );
          } else {
            expectedEndDate.setDate(expectedEndDate.getDate() + phaseDuration);
          }

          console.log(
            `  • Expected phase end date: ${expectedEndDate.toISOString()}`
          );
          console.log(
            `  • Should transition? ${now >= expectedEndDate ? "YES" : "NO"}`
          );

          // Check for notification windows
          await this.checkNotificationWindows(cycle, expectedEndDate, now);

          // If the expected end date has passed, transition the phase
          if (now >= expectedEndDate) {
            console.log(`  • 🚨 Phase end date has passed, transitioning...`);
            phaseChangePromises.push(this.handlePhaseTransition(cycle));
          } else {
            const timeRemaining = expectedEndDate.getTime() - now.getTime();
            const daysRemaining = Math.ceil(
              timeRemaining / (1000 * 60 * 60 * 24)
            );
            console.log(`  • Time remaining: ~${daysRemaining} days`);
          }
        } else {
          console.log(`  • ERROR: Unable to determine phase start date`);
        }
      }

      if (phaseChangePromises.length > 0) {
        console.log(
          `🔄 Executing ${phaseChangePromises.length} phase transitions...`
        );
        await Promise.allSettled(phaseChangePromises);
      } else {
        console.log(`✅ No cycles ready for phase transition`);
      }
    } catch (error) {
      console.error("❌ Error checking phase transitions:", error);
    }
  }

  /**
   * Check if all members in a channel have voted
   * @param cycle The cycle to check
   * @returns True if all members have voted, false otherwise
   */
  private async haveAllChannelMembersVoted(cycle: Cycle): Promise<boolean> {
    try {
      if (!this.ensureClient()) {
        console.error(
          "Cannot check channel members: Failed to initialize Slack client"
        );
        return false;
      }

      const channelId = cycle.getChannelId();

      // Get all members in the channel
      const response = await this.getClient().conversations.members({
        channel: channelId,
        limit: 1000, // Use a high limit to get all members
      });

      if (!response.ok || !response.members || response.members.length === 0) {
        console.log(`  • Failed to get channel members or channel is empty`);
        return false;
      }

      const channelMembers = response.members;
      console.log(`  • Channel has ${channelMembers.length} members`);

      // Get the suggestions for this cycle
      const suggestions = await Suggestion.getAllForCycle(cycle.getId());

      // Extract all voters (users who have already voted)
      const voterSet = new Set<string>();
      suggestions.forEach((suggestion) => {
        const voters = suggestion.getVoters();
        voters.forEach((voter) => voterSet.add(voter));
      });
      console.log(`  • ${voterSet.size} members have voted so far`);

      // Check if there are any non-bot users in the channel who haven't voted
      // We need to get user info for each member to check if they're a bot
      let nonBotMembers: string[] = [];

      for (const memberId of channelMembers) {
        try {
          // Skip checking app/bot users
          if (memberId.startsWith("B") || memberId.startsWith("U")) {
            const userInfo = await this.getClient().users.info({
              user: memberId,
            });
            if (
              userInfo.ok &&
              userInfo.user &&
              !userInfo.user.is_bot &&
              !userInfo.user.is_app_user
            ) {
              nonBotMembers.push(memberId);
            }
          }
        } catch (error) {
          console.log(
            `  • Error checking if user ${memberId} is a bot: ${error}`
          );
        }
      }

      console.log(`  • Channel has ${nonBotMembers.length} non-bot members`);

      // Check if every non-bot member has voted
      const allVoted = nonBotMembers.every((member) => voterSet.has(member));

      if (allVoted && nonBotMembers.length > 0) {
        console.log(
          `  • All ${nonBotMembers.length} non-bot members have voted`
        );
        return true;
      } else {
        const nonVoters = nonBotMembers.filter(
          (member) => !voterSet.has(member)
        );
        console.log(
          `  • ${nonVoters.length} non-bot members haven't voted yet`
        );
        return false;
      }
    } catch (error) {
      console.error(
        `  • Error checking channel members voting status: ${error}`
      );
      return false;
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
    if (!this.ensureClient()) {
      console.error(
        "Cannot send notifications: Failed to initialize Slack client"
      );
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
        (!("deadlineNotificationSent" in phaseTiming) ||
          !phaseTiming.deadlineNotificationSent)
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
    if (!this.ensureClient()) {
      console.error(
        "Cannot send deadline notification: Failed to initialize Slack client"
      );
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
    await this.getClient().chat.postMessage({
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
      console.log(`🔄 Handling phase transition for cycle ${cycle.getId()}`);
      console.log(`  • Current phase: ${currentPhase}`);

      // Special handling for discussion phase ending - complete the cycle
      if (currentPhase === CyclePhase.DISCUSSION) {
        console.log(`  • Discussion phase ending, completing cycle`);
        await this.completeCycle(cycle);
        return;
      }

      // For all other phases, continue with normal transition logic
      // Get the next phase
      const nextPhase = this.getNextPhase(currentPhase);
      console.log(`  • Next phase: ${nextPhase}`);

      // Check if the phase transition is valid
      console.log(`  • Validating transition to ${nextPhase}...`);
      const isValid = await this.validatePhaseTransition(cycle, nextPhase);
      console.log(
        `  • Transition validation result: ${isValid ? "VALID" : "INVALID"}`
      );

      if (isValid) {
        // Perform the phase transition
        console.log(`  • Performing transition to ${nextPhase}`);
        await this.transitionPhase(cycle, nextPhase);
      } else {
        // Phase transition is not valid, notify about the issue
        console.log(`  • Cannot transition, sending notification`);
        await this.notifyInvalidTransition(cycle, nextPhase);
      }
    } catch (error) {
      console.error(
        `❌ Error handling phase transition for cycle ${cycle.getId()}:`,
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

    console.log(
      `  • Validating transition from ${currentPhase} to ${nextPhase}`
    );
    console.log(`  • Number of suggestions: ${suggestions.length}`);
    console.log(`  • Selected book ID: ${cycle.getSelectedBookId() || "NONE"}`);

    // RULE 1: If currently in suggestion phase, need at least 3 suggestions to move on
    if (
      currentPhase === CyclePhase.SUGGESTION &&
      nextPhase !== CyclePhase.SUGGESTION &&
      suggestions.length < 3
    ) {
      console.log(
        `  • ❌ RULE 1 FAILED: Not enough suggestions (${suggestions.length} < 3)`
      );
      return false;
    }

    // RULE 2: If moving to reading or discussion phase, must have a selected book
    if (
      (nextPhase === CyclePhase.READING ||
        nextPhase === CyclePhase.DISCUSSION) &&
      !cycle.getSelectedBookId()
    ) {
      console.log(
        `  • ⚠️ RULE 2 CHECK: No selected book for ${nextPhase} phase`
      );

      // If in voting phase, could try to auto-select the winning book
      if (currentPhase === CyclePhase.VOTING) {
        console.log(`  • Attempting to auto-select a winning book...`);
        // Try to automatically select the winner
        const success = await this.autoSelectWinner(cycle);
        console.log(
          `  • Auto-select winner result: ${success ? "SUCCESS" : "FAILED"}`
        );
        return success;
      }

      console.log(
        `  • ❌ RULE 2 FAILED: No selected book and not in voting phase`
      );
      return false;
    }

    console.log(`  • ✅ All validation rules passed`);
    return true;
  }

  /**
   * Auto-select the winning book based on votes
   */
  private async autoSelectWinner(cycle: Cycle): Promise<boolean> {
    try {
      console.log(
        `    • Attempting to auto-select winner for cycle ${cycle.getId()}`
      );
      const suggestions = await Suggestion.getAllForCycle(cycle.getId());
      console.log(`    • Found ${suggestions.length} suggestions`);

      // Need at least some suggestions to select a winner
      if (suggestions.length === 0) {
        console.log(`    • ❌ No suggestions available`);
        return false;
      }

      // Count voters who have cast votes
      const voterSet = new Set<string>();
      suggestions.forEach((suggestion) => {
        const voters = suggestion.getVoters();
        voters.forEach((voter) => voterSet.add(voter));
      });
      console.log(`    • Total unique voters: ${voterSet.size}`);

      // Need at least some votes to select a winner
      if (voterSet.size === 0) {
        console.log(`    • ❌ No votes have been cast`);
        return false;
      }

      // Use the utility function to resolve ties and select a winner
      const winnerSuggestion = resolveTiesAndSelectWinner(
        suggestions,
        "    • "
      );

      if (!winnerSuggestion) {
        console.log(`    • ❌ Could not select a winner`);
        return false;
      }

      const winningBookId = winnerSuggestion.getId();

      console.log(
        `    • Selected winner: "${winnerSuggestion.getBookName()}" by ${winnerSuggestion.getAuthor()}`
      );

      // Update the cycle with the selected book
      await cycle.update({
        selectedBookId: winningBookId,
      });
      console.log(`    • ✅ Updated cycle with selected book ID`);

      return true;
    } catch (error) {
      console.error("❌ Error auto-selecting winner:", error);
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
    if (!this.ensureClient()) {
      console.error(
        "Cannot notify phase transition: Failed to initialize Slack client"
      );
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
    await this.getClient().chat.postMessage({
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
    if (!this.ensureClient()) {
      console.error(
        "Cannot notify invalid transition: Failed to initialize Slack client"
      );
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
    await this.getClient().chat.postMessage({
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
    if (!this.ensureClient()) {
      console.error(
        "Cannot notify cycle completion: Failed to initialize Slack client"
      );
      return;
    }

    const channelId = cycle.getChannelId();
    await this.getClient().chat.postMessage({
      channel: channelId,
      text: `:tada: *Book Club Cycle Completed!*\n\nThe book club cycle "${cycle.getName()}" has been completed and archived.\n\nTo start a new book club cycle, use the \`/chapters-start-cycle\` command.`,
    });

    console.log(`Cycle ${cycle.getId()} completed and archived`);
  }
}
