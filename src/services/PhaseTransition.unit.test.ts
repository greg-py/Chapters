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

// Import after mocking to avoid circular dependencies
import { Cycle, Suggestion } from "./";
import * as dtoModule from "../dto";

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

  describe("start and stop", () => {
    it("should not start if app is not set", () => {
      const service = new PhaseTransitionService(null);
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      service.start();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Cannot start PhaseTransitionService: App instance not set"
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
    it("should do nothing if no active cycles are found", async () => {
      vi.mocked(dtoModule.getAllActiveCycles).mockResolvedValue([]);

      await service.triggerCheck();

      expect(dtoModule.getAllActiveCycles).toHaveBeenCalled();
      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it("should check phase transitions for active cycles", async () => {
      // Mock console to prevent output during tests
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});

      // Setup mock cycle data
      const cycleId = new ObjectId();
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
            startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
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
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(cycleId),
        getChannelId: vi.fn().mockReturnValue("channel-123"),
        getName: vi.fn().mockReturnValue("Test Cycle"),
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.SUGGESTION),
        getCurrentPhaseStartDate: vi
          .fn()
          .mockReturnValue(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)),
        calculateCurrentPhaseEndDate: vi.fn().mockReturnValue(pastDate),
        getPhaseDurations: vi.fn().mockReturnValue({
          suggestion: 7,
          voting: 7,
          reading: 30,
          discussion: 7,
        }),
      });

      // Replace the default mock with our customized one
      vi.mocked(Cycle).mockImplementation(() => mockCycle);

      // Run the test
      await service.triggerCheck();

      // Validate core assertions
      expect(dtoModule.getAllActiveCycles).toHaveBeenCalled();
      expect(mockCycle.calculateCurrentPhaseEndDate).toHaveBeenCalled();

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
      // Mock console to prevent output during tests
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});

      // Setup mock cycle in discussion phase
      const cycleId = new ObjectId();
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
            startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
          },
        },
        selectedBookId: undefined,
      };

      vi.mocked(dtoModule.getAllActiveCycles).mockResolvedValue([
        mockCycleData,
      ]);

      // Create a proper mock cycle
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      const mockCycle = createMockCycle({
        getId: vi.fn().mockReturnValue(cycleId),
        getChannelId: vi.fn().mockReturnValue("channel-123"),
        getName: vi.fn().mockReturnValue("Test Cycle"),
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.DISCUSSION),
        getCurrentPhaseStartDate: vi
          .fn()
          .mockReturnValue(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)),
        calculateCurrentPhaseEndDate: vi.fn().mockReturnValue(pastDate),
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

      // Create a mock cycle
      const mockCycle = createMockCycle({
        getCurrentPhase: vi.fn().mockReturnValue(CyclePhase.VOTING),
      });

      // Use internal method to test auto-selection
      // @ts-ignore - accessing private method for testing
      const result = await service.autoSelectWinner(mockCycle);

      expect(result).toBe(true);
      expect(mockCycle.update).toHaveBeenCalledWith({
        selectedBookId: suggestionId,
      });
    });
  });
});
