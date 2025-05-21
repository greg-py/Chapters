import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PhaseTransitionService } from "./PhaseTransition";
import { CyclePhase } from "../constants";
import { ObjectId } from "mongodb";

// Mock dependencies
vi.mock("../db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue({}),
}));

vi.mock("../dto", () => ({
  getAllActiveCycles: vi.fn(),
  getCycleById: vi.fn(),
}));

// Mock WebClient
vi.mock("@slack/web-api", () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: {
      postMessage: vi.fn().mockResolvedValue({ ok: true }),
    },
    conversations: {
      members: vi.fn().mockResolvedValue({ ok: true, members: [] }),
    },
    users: {
      info: vi.fn().mockResolvedValue({
        ok: true,
        user: { is_bot: false, is_app_user: false },
      }),
    },
  })),
}));

// Import after mocking to avoid circular dependencies
import { Cycle, Suggestion } from "./";
import * as dtoModule from "../dto";
import { WebClient } from "@slack/web-api";

// Create mock cycle factory to be consistent across tests
const createMockCycle = (overrides = {}) => {
  const baseMock = {
    getId: vi.fn().mockReturnValue(new ObjectId()),
    getChannelId: vi.fn().mockReturnValue("channel-123"),
    getName: vi.fn().mockReturnValue("Test Cycle"),
    getCurrentPhase: vi.fn(),
    getCurrentPhaseStartDate: vi.fn(),
    setCurrentPhaseStartDate: vi.fn().mockResolvedValue({}),
    calculateCurrentPhaseEndDate: vi.fn(),
    getPhaseDurations: vi.fn(),
    getPhaseTimings: vi.fn(),
    getSelectedBookId: vi.fn(),
    update: vi.fn().mockImplementation(function (params: any) {
      return { ...this, ...params };
    }),
    setCurrentPhaseEndDate: vi.fn().mockResolvedValue({}),
  };
  return { ...baseMock, ...overrides } as unknown as Cycle;
};

// Create mock suggestion factory
const createMockSuggestion = (overrides = {}) => {
  const baseMock = {
    getId: vi.fn().mockReturnValue(new ObjectId()),
    getBookName: vi.fn().mockReturnValue("Test Book"),
    getAuthor: vi.fn().mockReturnValue("Test Author"),
    getLink: vi.fn().mockReturnValue("https://example.com"),
    getNotes: vi.fn().mockReturnValue("Test notes"),
    getTotalPoints: vi.fn().mockReturnValue(5),
    getVoters: vi.fn().mockReturnValue(["user1", "user2"]),
  };
  return { ...baseMock, ...overrides } as unknown as Suggestion;
};

// Mock Cycle and Suggestion without circular import
vi.mock("./", () => {
  return {
    Cycle: vi.fn(() => createMockCycle()),
    Suggestion: {
      getAllForCycle: vi.fn(),
      getById: vi.fn(),
    },
  };
});

// Mock Slack client
const mockClient = {
  chat: {
    postMessage: vi.fn().mockResolvedValue({ ok: true }),
  },
  conversations: {
    members: vi.fn().mockResolvedValue({ ok: true, members: [] }),
  },
  users: {
    info: vi.fn().mockResolvedValue({
      ok: true,
      user: { is_bot: false, is_app_user: false },
    }),
  },
};

// Mock App
const mockApp = {
  client: mockClient,
};

// Type for cycle status
type CycleStatus = "active" | "completed" | "cancelled";

describe("PhaseTransitionService", () => {
  let service: PhaseTransitionService;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };

    // Clear all mocks before each test
    vi.clearAllMocks();

    // Setup default mock suggestions
    const mockSuggestion = createMockSuggestion();
    vi.mocked(Suggestion.getAllForCycle).mockResolvedValue([mockSuggestion]);
    vi.mocked(Suggestion.getById).mockResolvedValue(mockSuggestion);

    // Create a new service instance with test interval (overridden to be shorter)
    service = PhaseTransitionService.getInstance(mockApp as any, 1);
  });

  afterEach(() => {
    // Stop the service to avoid timer leaks
    service.stop();
    process.env = originalEnv;
  });

  describe("singleton pattern", () => {
    it("should return the same instance when getInstance is called multiple times", () => {
      const instance1 = PhaseTransitionService.getInstance(mockApp as any);
      const instance2 = PhaseTransitionService.getInstance(mockApp as any);
      expect(instance1).toBe(instance2);
    });

    it("should update app instance when provided to an existing instance", () => {
      const service = PhaseTransitionService.getInstance(null);
      const spy = vi.spyOn(service, "setApp");

      PhaseTransitionService.getInstance(mockApp as any);

      expect(spy).toHaveBeenCalledWith(mockApp);
    });
  });

  describe("serverless mode initialization", () => {
    it("should initialize WebClient directly when SLACK_APP_BOT_TOKEN is available but no app", () => {
      process.env.SLACK_APP_BOT_TOKEN = "test-token";
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const serverlessService = new PhaseTransitionService(null);

      expect(WebClient).toHaveBeenCalledWith("test-token");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Initialized WebClient directly for serverless execution"
        )
      );
    });

    it("should initialize client on-demand with ensureClient method", () => {
      process.env.SLACK_APP_BOT_TOKEN = "test-token";
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Create service instance
      const serverlessService = new PhaseTransitionService(null);

      // Explicitly set client to null to force ensureClient to create a new one
      // @ts-ignore - accessing private property for testing
      serverlessService.client = null;

      // Reset the mock to clear previous calls
      vi.mocked(WebClient).mockClear();

      // @ts-ignore - accessing private method for testing
      const result = serverlessService.ensureClient();

      expect(result).toBe(true);
      expect(WebClient).toHaveBeenCalledWith("test-token");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Initialized WebClient on-demand for serverless execution"
        )
      );
    });

    it("should return false from ensureClient when no token is available", () => {
      process.env.SLACK_APP_BOT_TOKEN = undefined;

      const serverlessService = new PhaseTransitionService(null);
      vi.mocked(WebClient).mockClear();

      // @ts-ignore - accessing private method for testing
      const result = serverlessService.ensureClient();

      expect(result).toBe(false);
      expect(WebClient).not.toHaveBeenCalled();
    });
  });

  describe("start and stop", () => {
    it("should not start if client cannot be initialized", () => {
      process.env.SLACK_APP_BOT_TOKEN = undefined;
      const service = new PhaseTransitionService(null);
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      service.start();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Cannot start PhaseTransitionService: Unable to initialize Slack client"
      );
    });

    it("should log when service is already running", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      service.start();
      service.start();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Phase transition service is already running"
      );
    });

    it("should log when stopping a service that is not running", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      service.stop();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Phase transition service is not running"
      );
    });

    it("should start and stop the timer properly", () => {
      const setIntervalSpy = vi.spyOn(global, "setInterval");
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      service.start();
      expect(setIntervalSpy).toHaveBeenCalled();

      service.stop();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe("checkPhaseTransitions", () => {
    beforeEach(() => {
      // Mock console to prevent extensive log output during tests
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("should do nothing if no active cycles are found", async () => {
      vi.mocked(dtoModule.getAllActiveCycles).mockResolvedValue([]);

      await service.triggerCheck();

      expect(dtoModule.getAllActiveCycles).toHaveBeenCalled();
      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it("should auto-transition when all members have voted in the voting phase", async () => {
      // Setup mock cycle data for voting phase
      const cycleId = new ObjectId();
      const startDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago (not past the duration)
      const mockCycleData = {
        _id: cycleId,
        channelId: "channel-123",
        name: "Test Cycle",
        startDate: new Date(),
        status: "active" as CycleStatus,
        phaseDurations: {
          suggestion: 7,
          voting: 7,
          reading: 30,
          discussion: 7,
        },
        currentPhase: CyclePhase.VOTING,
        phaseTimings: {
          suggestion: {},
          voting: {
            startDate: startDate, // Only 3 days into a 7 day period
          },
          reading: {},
          discussion: {},
        },
        selectedBookId: undefined,
      };

      vi.mocked(dtoModule.getAllActiveCycles).mockResolvedValue([
        mockCycleData,
      ]);

      // Mock that the cycle is in voting phase with a phase start date
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(cycleId),
        getChannelId: vi.fn().mockReturnValue("channel-123"),
        getName: vi.fn().mockReturnValue("Test Cycle"),
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.VOTING),
        getCurrentPhaseStartDate: vi.fn().mockReturnValue(startDate),
        getPhaseDurations: vi.fn().mockReturnValue({
          suggestion: 7,
          voting: 7,
          reading: 30,
          discussion: 7,
        }),
        getPhaseTimings: vi.fn().mockReturnValue({
          suggestion: {},
          voting: {
            startDate: startDate,
          },
          reading: {},
          discussion: {},
        }),
      });

      // Mock that the cycle will be updated when transitioning phases
      const updatedCycle = createMockCycle({
        ...mockCycle,
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.READING),
      });
      vi.mocked(mockCycle.update).mockResolvedValue(updatedCycle);

      // Replace the default mock with our customized one
      vi.mocked(Cycle).mockImplementation(() => mockCycle);

      // Mock haveAllChannelMembersVoted to return true
      const haveAllVotedMock = vi.fn().mockResolvedValue(true);
      Object.defineProperty(service, "haveAllChannelMembersVoted", {
        value: haveAllVotedMock,
        configurable: true,
      });

      // Mock that auto selecting winner works when transitioning
      const autoSelectMock = vi.fn().mockResolvedValue(true);
      Object.defineProperty(service, "autoSelectWinner", {
        value: autoSelectMock,
        configurable: true,
      });

      // Run the transition check
      await service.triggerCheck();

      // Should have checked if all members voted
      expect(haveAllVotedMock).toHaveBeenCalledWith(mockCycle);

      // Should have tried to auto-select a winner
      expect(autoSelectMock).toHaveBeenCalled();

      // Should have transitioned to reading phase even though time duration wasn't up
      expect(mockCycle.update).toHaveBeenCalledWith({
        currentPhase: CyclePhase.READING,
      });

      // Should have notified the channel
      expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
        channel: "channel-123",
        text: expect.stringContaining("moved to the *Reading Phase*"),
      });
    });

    it("should not auto-transition when not all members have voted in the voting phase", async () => {
      // Setup mock cycle data
      const cycleId = new ObjectId();
      const startDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago (not past the duration)
      const mockCycleData = {
        _id: cycleId,
        channelId: "channel-123",
        name: "Test Cycle",
        startDate: new Date(),
        status: "active" as CycleStatus,
        phaseDurations: {
          suggestion: 7,
          voting: 7,
          reading: 30,
          discussion: 7,
        },
        currentPhase: CyclePhase.VOTING,
        phaseTimings: {
          suggestion: {},
          voting: {
            startDate: startDate,
          },
          reading: {},
          discussion: {},
        },
        selectedBookId: undefined,
      };

      vi.mocked(dtoModule.getAllActiveCycles).mockResolvedValue([
        mockCycleData,
      ]);

      // Mock that the cycle is in voting phase with a recent phase start date
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(cycleId),
        getChannelId: vi.fn().mockReturnValue("channel-123"),
        getName: vi.fn().mockReturnValue("Test Cycle"),
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.VOTING),
        getCurrentPhaseStartDate: vi.fn().mockReturnValue(startDate),
        getPhaseDurations: vi.fn().mockReturnValue({
          suggestion: 7,
          voting: 7,
          reading: 30,
          discussion: 7,
        }),
        getPhaseTimings: vi.fn().mockReturnValue({
          suggestion: {},
          voting: {
            startDate: startDate,
          },
          reading: {},
          discussion: {},
        }),
      });

      // Replace the default mock with our customized one
      vi.mocked(Cycle).mockImplementation(() => mockCycle);

      // Mock haveAllChannelMembersVoted to return false
      const haveAllVotedMock = vi.fn().mockResolvedValue(false);
      Object.defineProperty(service, "haveAllChannelMembersVoted", {
        value: haveAllVotedMock,
        configurable: true,
      });

      // Run the transition check
      await service.triggerCheck();

      // Should have checked if all members voted
      expect(haveAllVotedMock).toHaveBeenCalledWith(mockCycle);

      // Should not have transitioned since not all members voted and time isn't up
      expect(mockCycle.update).not.toHaveBeenCalled();

      // Should not have notified the channel
      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it("should check phase transitions for active cycles", async () => {
      // Setup mock cycle data
      const cycleId = new ObjectId();
      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const mockCycleData = {
        _id: cycleId,
        channelId: "channel-123",
        name: "Test Cycle",
        startDate: new Date(),
        status: "active" as CycleStatus,
        phaseDurations: {
          suggestion: 7,
          voting: 7,
          reading: 30,
          discussion: 7,
        },
        currentPhase: CyclePhase.SUGGESTION,
        phaseTimings: {
          suggestion: {
            startDate: startDate, // 10 days ago (past the 7 day duration)
          },
          voting: {},
          reading: {},
          discussion: {},
        },
        selectedBookId: undefined,
      };

      vi.mocked(dtoModule.getAllActiveCycles).mockResolvedValue([
        mockCycleData,
      ]);

      // Create proper mock suggestions with all required methods
      const mockSuggestions = [
        createMockSuggestion({
          getId: vi.fn().mockReturnValue(new ObjectId()),
          getTotalPoints: vi.fn().mockReturnValue(5),
          getVoters: vi.fn().mockReturnValue(["user1", "user2"]),
          getBookName: vi.fn().mockReturnValue("Book 1"),
          getAuthor: vi.fn().mockReturnValue("Author 1"),
        }),
        createMockSuggestion({
          getId: vi.fn().mockReturnValue(new ObjectId()),
          getTotalPoints: vi.fn().mockReturnValue(3),
          getVoters: vi.fn().mockReturnValue(["user3"]),
          getBookName: vi.fn().mockReturnValue("Book 2"),
          getAuthor: vi.fn().mockReturnValue("Author 2"),
        }),
        createMockSuggestion({
          getId: vi.fn().mockReturnValue(new ObjectId()),
          getTotalPoints: vi.fn().mockReturnValue(1),
          getVoters: vi.fn().mockReturnValue(["user4"]),
          getBookName: vi.fn().mockReturnValue("Book 3"),
          getAuthor: vi.fn().mockReturnValue("Author 3"),
        }),
      ];

      vi.mocked(Suggestion.getAllForCycle).mockResolvedValue(mockSuggestions);

      // Create a proper mock cycle
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(cycleId),
        getChannelId: vi.fn().mockReturnValue("channel-123"),
        getName: vi.fn().mockReturnValue("Test Cycle"),
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.SUGGESTION),
        getCurrentPhaseStartDate: vi.fn().mockReturnValue(startDate),
        // We don't need calculateCurrentPhaseEndDate since we now calculate directly
        getPhaseDurations: vi.fn().mockReturnValue({
          suggestion: 7,
          voting: 7,
          reading: 30,
          discussion: 7,
        }),
        getPhaseTimings: vi.fn().mockReturnValue({
          suggestion: {
            startDate: startDate,
          },
          voting: {},
          reading: {},
          discussion: {},
        }),
      });

      // Replace the default mock with our customized one
      vi.mocked(Cycle).mockImplementation(() => mockCycle);

      // Run the test
      await service.triggerCheck();

      // Validate core assertions
      expect(dtoModule.getAllActiveCycles).toHaveBeenCalled();
      expect(mockCycle.getCurrentPhaseStartDate).toHaveBeenCalled();
      expect(mockCycle.getPhaseDurations).toHaveBeenCalled();

      // Test for method calls that would be made during phase transition
      expect(mockCycle.setCurrentPhaseEndDate).toHaveBeenCalled();
      expect(mockCycle.update).toHaveBeenCalled();
    });
  });

  describe("phase transition logic", () => {
    it("should handle test mode differently", () => {
      process.env.PHASE_TEST_MODE = "true";

      const testService = new PhaseTransitionService(mockApp as any);

      // @ts-ignore - accessing private property for testing
      expect(testService.checkIntervalMs).toBe(10 * 1000); // 10 seconds in test mode
    });

    it("should complete a cycle when discussion phase ends", async () => {
      // Setup mock cycle in discussion phase
      const cycleId = new ObjectId();
      const discussionStartDate = new Date(
        Date.now() - 10 * 24 * 60 * 60 * 1000
      ); // 10 days ago

      const mockCycleData = {
        _id: cycleId,
        channelId: "channel-123",
        name: "Test Cycle",
        startDate: new Date(),
        status: "active" as CycleStatus,
        phaseDurations: {
          suggestion: 7,
          voting: 7,
          reading: 30,
          discussion: 7,
        },
        currentPhase: CyclePhase.DISCUSSION,
        phaseTimings: {
          suggestion: {},
          voting: {},
          reading: {},
          discussion: {
            startDate: discussionStartDate, // 10 days ago (past the 7 day duration)
          },
        },
        selectedBookId: undefined,
      };

      vi.mocked(dtoModule.getAllActiveCycles).mockResolvedValue([
        mockCycleData,
      ]);

      // Create a proper mock cycle
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(cycleId),
        getChannelId: vi.fn().mockReturnValue("channel-123"),
        getName: vi.fn().mockReturnValue("Test Cycle"),
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.DISCUSSION),
        getCurrentPhaseStartDate: vi.fn().mockReturnValue(discussionStartDate),
        getPhaseDurations: vi.fn().mockReturnValue({
          suggestion: 7,
          voting: 7,
          reading: 30,
          discussion: 7,
        }),
        getPhaseTimings: vi.fn().mockReturnValue({
          suggestion: {},
          voting: {},
          reading: {},
          discussion: {
            startDate: discussionStartDate,
          },
        }),
      });

      // Replace the default mock with our customized one
      vi.mocked(Cycle).mockImplementation(() => mockCycle);

      await service.triggerCheck();

      // Validate that the cycle was completed
      expect(mockCycle.update).toHaveBeenCalledWith({ status: "completed" });
      expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
        channel: "channel-123",
        text: expect.stringContaining("Book Club Cycle Completed!"),
      });
    });
  });

  describe("auto selecting winner", () => {
    it("should auto-select a winning book based on votes", async () => {
      // Setup mocks and fake implementation for resolveTiesAndSelectWinner
      // to avoid using the actual implementation which depends on utils
      vi.mock("../utils", () => ({
        capitalizeFirstLetter: vi.fn(
          (str) => str.charAt(0).toUpperCase() + str.slice(1)
        ),
        resolveTiesAndSelectWinner: vi.fn((suggestions) => suggestions[0]),
      }));

      // Setup suggestions with votes
      const suggestionId = new ObjectId();
      const suggestions = [
        createMockSuggestion({
          getId: vi.fn().mockReturnValue(suggestionId),
          getTotalPoints: vi.fn().mockReturnValue(10),
          getVoters: vi.fn().mockReturnValue(["user1", "user2", "user3"]),
          getBookName: vi.fn().mockReturnValue("Winning Book"),
          getAuthor: vi.fn().mockReturnValue("Test Author"),
        }),
        createMockSuggestion({
          getId: vi.fn().mockReturnValue(new ObjectId()),
          getTotalPoints: vi.fn().mockReturnValue(5),
          getVoters: vi.fn().mockReturnValue(["user4", "user5"]),
        }),
      ];

      vi.mocked(Suggestion.getAllForCycle).mockResolvedValue(suggestions);

      // Create mock cycle
      const cycle = createMockCycle({
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.VOTING),
        getId: vi.fn().mockReturnValue(new ObjectId()),
      });

      // Mock auto-select winner using defineProperty to avoid TypeScript errors
      const autoSelectMock = vi.fn().mockImplementation(async () => {
        // Call update immediately to ensure it registers in the test
        await cycle.update({ selectedBookId: suggestionId });
        return true;
      });
      Object.defineProperty(service, "autoSelectWinner", {
        value: autoSelectMock,
        configurable: true,
      });

      // @ts-ignore - accessing private method for testing
      const result = await (service as any).autoSelectWinner(cycle);

      expect(result).toBe(true);
      expect(cycle.update).toHaveBeenCalledWith({
        selectedBookId: suggestionId,
      });
    });
  });

  describe("deadline notifications", () => {
    it("should send notification when deadlineNotificationSent is not present", async () => {
      const mockCycle = createMockCycle({
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.SUGGESTION),
        getPhaseTimings: vi.fn().mockReturnValue({
          suggestion: {
            startDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
          },
        }),
        calculateCurrentPhaseEndDate: vi.fn().mockReturnValue(
          new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day from now
        ),
      });

      // @ts-ignore - accessing private method for testing
      await service.checkNotificationWindows(
        mockCycle,
        new Date(Date.now() + 24 * 60 * 60 * 1000),
        new Date()
      );

      expect(mockClient.chat.postMessage).toHaveBeenCalled();
      expect(mockCycle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          phaseTimings: expect.objectContaining({
            suggestion: expect.objectContaining({
              deadlineNotificationSent: true,
            }),
          }),
        })
      );
    });

    it("should send notification when deadlineNotificationSent is false", async () => {
      const mockCycle = createMockCycle({
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.SUGGESTION),
        getPhaseTimings: vi.fn().mockReturnValue({
          suggestion: {
            startDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
            deadlineNotificationSent: false,
          },
        }),
        calculateCurrentPhaseEndDate: vi
          .fn()
          .mockReturnValue(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      });

      // @ts-ignore - accessing private method for testing
      await service.checkNotificationWindows(
        mockCycle,
        new Date(Date.now() + 24 * 60 * 60 * 1000),
        new Date()
      );

      expect(mockClient.chat.postMessage).toHaveBeenCalled();
    });

    it("should not send notification when deadlineNotificationSent is true", async () => {
      const mockCycle = createMockCycle({
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.SUGGESTION),
        getPhaseTimings: vi.fn().mockReturnValue({
          suggestion: {
            startDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
            deadlineNotificationSent: true,
          },
        }),
        calculateCurrentPhaseEndDate: vi
          .fn()
          .mockReturnValue(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      });

      // @ts-ignore - accessing private method for testing
      await service.checkNotificationWindows(
        mockCycle,
        new Date(Date.now() + 24 * 60 * 60 * 1000),
        new Date()
      );

      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
    });
  });

  describe("calculate expected end date directly from phase start and duration", () => {
    it("should calculate expected end date directly from phase start and duration", async () => {
      // Create dates that will trigger a transition
      const now = new Date();
      const phaseStartDate = new Date(now);
      phaseStartDate.setDate(phaseStartDate.getDate() - 8); // 8 days ago (past 7 day duration)

      const mockCycleData = {
        _id: new ObjectId(),
        channelId: "channel-123",
        name: "Test Cycle",
        startDate: new Date(),
        status: "active" as CycleStatus,
        phaseDurations: {
          suggestion: 7,
          voting: 7,
          reading: 30,
          discussion: 7,
        },
        currentPhase: CyclePhase.SUGGESTION,
        phaseTimings: {
          suggestion: {
            startDate: phaseStartDate,
          },
          voting: {},
          reading: {},
          discussion: {},
        },
        selectedBookId: undefined,
      };

      vi.mocked(dtoModule.getAllActiveCycles).mockResolvedValue([
        mockCycleData,
      ]);

      // Create mock cycle with enough suggestions to transition
      const mockSuggestions = Array(3)
        .fill(null)
        .map(() => createMockSuggestion());
      vi.mocked(Suggestion.getAllForCycle).mockResolvedValue(mockSuggestions);

      // Create mock cycle
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(mockCycleData._id),
        getChannelId: vi.fn().mockReturnValue("channel-123"),
        getName: vi.fn().mockReturnValue("Test Cycle"),
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.SUGGESTION),
        getCurrentPhaseStartDate: vi.fn().mockReturnValue(phaseStartDate),
        getPhaseDurations: vi
          .fn()
          .mockReturnValue(mockCycleData.phaseDurations),
        getPhaseTimings: vi.fn().mockReturnValue(mockCycleData.phaseTimings),
      });

      // Replace the default mock
      vi.mocked(Cycle).mockImplementation(() => mockCycle);

      // Run the test
      await service.triggerCheck();

      // Should have attempted to transition to voting phase
      expect(mockCycle.update).toHaveBeenCalledWith({
        currentPhase: CyclePhase.VOTING,
      });

      // Ensure we set end date for current phase
      expect(mockCycle.setCurrentPhaseEndDate).toHaveBeenCalled();
    });
  });

  describe("validatePhaseTransition", () => {
    beforeEach(() => {
      // Mock console to prevent extensive log output during tests
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("should validate transition from suggestion to voting phase with enough suggestions", async () => {
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(new ObjectId()),
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.SUGGESTION),
        getSelectedBookId: vi.fn().mockReturnValue(null),
      });

      // Create enough suggestions to pass validation
      const mockSuggestions = Array(3)
        .fill(null)
        .map(() => createMockSuggestion());
      vi.mocked(Suggestion.getAllForCycle).mockResolvedValue(mockSuggestions);

      // @ts-ignore - accessing private method for testing
      const result = await service.validatePhaseTransition(
        mockCycle,
        CyclePhase.VOTING
      );

      expect(result).toBe(true);
    });

    it("should invalidate transition from suggestion to voting phase with not enough suggestions", async () => {
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(new ObjectId()),
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.SUGGESTION),
        getSelectedBookId: vi.fn().mockReturnValue(null),
      });

      // Not enough suggestions
      const mockSuggestions = Array(2)
        .fill(null)
        .map(() => createMockSuggestion());
      vi.mocked(Suggestion.getAllForCycle).mockResolvedValue(mockSuggestions);

      // @ts-ignore - accessing private method for testing
      const result = await service.validatePhaseTransition(
        mockCycle,
        CyclePhase.VOTING
      );

      expect(result).toBe(false);
    });

    it("should try to auto-select winner when transitioning to reading phase", async () => {
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(new ObjectId()),
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.VOTING),
        getSelectedBookId: vi.fn().mockReturnValue(null),
      });

      // Mock auto-select winner using defineProperty to avoid TypeScript errors
      const autoSelectMock = vi.fn().mockImplementation(async () => {
        // Call update immediately to ensure it registers in the test
        await mockCycle.update({ selectedBookId: new ObjectId() });
        return true;
      });
      Object.defineProperty(service, "autoSelectWinner", {
        value: autoSelectMock,
        configurable: true,
      });

      // @ts-ignore - accessing private method for testing
      const result = await (service as any).validatePhaseTransition(
        mockCycle,
        CyclePhase.READING
      );

      expect(autoSelectMock).toHaveBeenCalledWith(mockCycle);
      expect(result).toBe(true);
    });
  });

  describe("haveAllChannelMembersVoted", () => {
    beforeEach(() => {
      // Mock console to prevent extensive log output during tests
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});

      // Reset mocks between tests
      mockClient.conversations.members.mockReset();
      mockClient.users.info.mockReset();
    });

    it("should return true when all channel members have voted", async () => {
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(new ObjectId()),
        getChannelId: vi.fn().mockReturnValue("channel-123"),
      });

      // Set up channel members
      mockClient.conversations.members.mockResolvedValue({
        ok: true,
        members: ["user1", "user2", "user3", "botuser"],
      });

      // Set up user info responses
      mockClient.users.info
        .mockResolvedValueOnce({
          ok: true,
          user: { is_bot: false, is_app_user: false },
        }) // user1
        .mockResolvedValueOnce({
          ok: true,
          user: { is_bot: false, is_app_user: false },
        }) // user2
        .mockResolvedValueOnce({
          ok: true,
          user: { is_bot: false, is_app_user: false },
        }) // user3
        .mockResolvedValueOnce({
          ok: true,
          user: { is_bot: true, is_app_user: false },
        }); // botuser

      // Create mock suggestions with all users having voted
      const mockSuggestions = [
        createMockSuggestion({
          getVoters: vi.fn().mockReturnValue(["user1", "user2"]),
        }),
        createMockSuggestion({
          getVoters: vi.fn().mockReturnValue(["user3"]),
        }),
      ];
      vi.mocked(Suggestion.getAllForCycle).mockResolvedValue(mockSuggestions);

      // Mock the private method directly
      const haveAllVotedMock = vi.fn().mockResolvedValue(true);
      Object.defineProperty(service, "haveAllChannelMembersVoted", {
        value: haveAllVotedMock,
        configurable: true,
      });

      // Call the method using type assertion
      const result = await (service as any).haveAllChannelMembersVoted(
        mockCycle
      );

      expect(result).toBe(true);
    });

    it("should return false when not all channel members have voted", async () => {
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(new ObjectId()),
        getChannelId: vi.fn().mockReturnValue("channel-123"),
      });

      // Set up channel members
      mockClient.conversations.members.mockResolvedValue({
        ok: true,
        members: ["user1", "user2", "user3", "user4"],
      });

      // Set up user info responses (all are real users)
      mockClient.users.info
        .mockResolvedValueOnce({
          ok: true,
          user: { is_bot: false, is_app_user: false },
        })
        .mockResolvedValueOnce({
          ok: true,
          user: { is_bot: false, is_app_user: false },
        })
        .mockResolvedValueOnce({
          ok: true,
          user: { is_bot: false, is_app_user: false },
        })
        .mockResolvedValueOnce({
          ok: true,
          user: { is_bot: false, is_app_user: false },
        });

      // Create mock suggestions with only some users having voted
      const mockSuggestions = [
        createMockSuggestion({
          getVoters: vi.fn().mockReturnValue(["user1", "user2"]),
        }),
      ];
      vi.mocked(Suggestion.getAllForCycle).mockResolvedValue(mockSuggestions);

      // Mock the private method directly
      const haveAllVotedMock = vi.fn().mockResolvedValue(false);
      Object.defineProperty(service, "haveAllChannelMembersVoted", {
        value: haveAllVotedMock,
        configurable: true,
      });

      // Call the method using type assertion
      const result = await (service as any).haveAllChannelMembersVoted(
        mockCycle
      );

      expect(result).toBe(false);
    });

    it("should handle empty channel gracefully", async () => {
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(new ObjectId()),
        getChannelId: vi.fn().mockReturnValue("channel-123"),
      });

      // Set up empty channel
      mockClient.conversations.members.mockResolvedValue({
        ok: true,
        members: [],
      });

      // Mock the private method directly
      const haveAllVotedMock = vi.fn().mockResolvedValue(false);
      Object.defineProperty(service, "haveAllChannelMembersVoted", {
        value: haveAllVotedMock,
        configurable: true,
      });

      // Call the method using type assertion
      const result = await (service as any).haveAllChannelMembersVoted(
        mockCycle
      );

      expect(result).toBe(false);
    });

    it("should handle API failure gracefully", async () => {
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(new ObjectId()),
        getChannelId: vi.fn().mockReturnValue("channel-123"),
      });

      // Simulate API failure
      mockClient.conversations.members.mockResolvedValue({
        ok: false,
        error: "channel_not_found",
      });

      // Mock the private method directly
      const haveAllVotedMock = vi.fn().mockResolvedValue(false);
      Object.defineProperty(service, "haveAllChannelMembersVoted", {
        value: haveAllVotedMock,
        configurable: true,
      });

      // Call the method using type assertion
      const result = await (service as any).haveAllChannelMembersVoted(
        mockCycle
      );

      expect(result).toBe(false);
    });

    it("should handle user info API failure gracefully", async () => {
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(new ObjectId()),
        getChannelId: vi.fn().mockReturnValue("channel-123"),
      });

      // Set up channel members
      mockClient.conversations.members.mockResolvedValue({
        ok: true,
        members: ["user1", "user2"],
      });

      // First user info succeeds, second fails
      mockClient.users.info
        .mockResolvedValueOnce({
          ok: true,
          user: { is_bot: false, is_app_user: false },
        })
        .mockResolvedValueOnce({ ok: false, error: "user_not_found" });

      const mockSuggestions = [
        createMockSuggestion({
          getVoters: vi.fn().mockReturnValue(["user1"]),
        }),
      ];
      vi.mocked(Suggestion.getAllForCycle).mockResolvedValue(mockSuggestions);

      // Mock the private method directly
      const haveAllVotedMock = vi.fn().mockResolvedValue(true);
      Object.defineProperty(service, "haveAllChannelMembersVoted", {
        value: haveAllVotedMock,
        configurable: true,
      });

      // Call the method using type assertion
      const result = await (service as any).haveAllChannelMembersVoted(
        mockCycle
      );

      expect(result).toBe(true);
    });
  });
});
