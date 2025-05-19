import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ObjectId, Db } from "mongodb";

// Mock dependencies with factory functions
vi.mock("../db", () => {
  return {
    connectToDatabase: vi.fn().mockResolvedValue({} as Db),
  };
});

vi.mock("../dto", () => {
  return {
    getActiveCycleInChannel: vi.fn(),
    createCycle: vi.fn(),
    updateCycle: vi.fn(),
    getSuggestionsByCycle: vi.fn(),
  };
});

vi.mock("../config", () => {
  return {
    getPhaseConfig: vi.fn().mockReturnValue({
      suggestion: 7,
      voting: 7,
      reading: 30,
      discussion: 7,
    }),
  };
});

// Import the real classes after mocking dependencies
import { Cycle } from "./Cycle";
import { CyclePhase } from "../constants";
import * as dtoModule from "../dto";
import * as configModule from "../config";
import * as dbModule from "../db";

describe("Cycle", () => {
  const mockDate = new Date("2023-01-01T00:00:00.000Z");
  // Create a mock database object that will be used in tests
  const mockDb = {} as Db;

  vi.useFakeTimers();
  vi.setSystemTime(mockDate);

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up the mock database for each test
    vi.mocked(dbModule.connectToDatabase).mockResolvedValue(mockDb);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("static createNew", () => {
    it("should create a new cycle with default values", async () => {
      // Mock dependencies
      const mockObjectId = new ObjectId();
      vi.spyOn(ObjectId.prototype, "toHexString").mockReturnValue(
        mockObjectId.toHexString()
      );
      vi.mocked(dtoModule.getActiveCycleInChannel).mockResolvedValue(null);
      vi.mocked(dtoModule.createCycle).mockResolvedValue(mockObjectId);
      vi.mocked(configModule.getPhaseConfig).mockReturnValue({
        suggestion: 7,
        voting: 7,
        reading: 30,
        discussion: 7,
      });

      // Execute
      const cycle = await Cycle.createNew("channel-123");

      // Assert
      expect(dtoModule.getActiveCycleInChannel).toHaveBeenCalledWith(
        mockDb,
        "channel-123"
      );
      expect(dtoModule.createCycle).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          channelId: "channel-123",
          name: expect.any(String),
          currentPhase: "pending",
          startDate: mockDate,
          status: "active",
          phaseDurations: {
            suggestion: 7,
            voting: 7,
            reading: 30,
            discussion: 7,
          },
        })
      );
      expect(cycle).toBeInstanceOf(Cycle);
      expect(cycle.getChannelId()).toBe("channel-123");
      expect(cycle.getCurrentPhase()).toBe("pending");
      expect(cycle.getStatus()).toBe("active");
    });

    it("should throw an error if an active cycle already exists", async () => {
      // Mock dependencies
      vi.mocked(dtoModule.getActiveCycleInChannel).mockResolvedValue({
        _id: new ObjectId(),
        channelId: "channel-123",
        name: "Existing Cycle",
        currentPhase: "suggestion",
        startDate: new Date(),
        status: "active",
        phaseDurations: {},
      });

      // Execute and assert
      await expect(Cycle.createNew("channel-123")).rejects.toThrow(
        "An active cycle already exists for this channel"
      );
    });
  });

  describe("static getActive", () => {
    it("should return the active cycle for a channel", async () => {
      // Mock dependencies
      const mockCycleData = {
        _id: new ObjectId(),
        channelId: "channel-123",
        name: "Test Cycle",
        currentPhase: "suggestion",
        startDate: new Date(),
        status: "active",
        phaseDurations: {
          suggestion: 7,
          voting: 7,
          reading: 30,
          discussion: 7,
        },
        selectedBookId: new ObjectId(),
        phaseTimings: {
          suggestion: { startDate: new Date() },
        },
      };
      vi.mocked(dtoModule.getActiveCycleInChannel).mockResolvedValue(
        mockCycleData
      );

      // Execute
      const cycle = await Cycle.getActive("channel-123");

      // Assert
      expect(dtoModule.getActiveCycleInChannel).toHaveBeenCalledWith(
        mockDb,
        "channel-123"
      );
      expect(cycle).toBeInstanceOf(Cycle);
      expect(cycle?.getId()).toEqual(mockCycleData._id);
      expect(cycle?.getChannelId()).toBe("channel-123");
      expect(cycle?.getName()).toBe("Test Cycle");
      expect(cycle?.getCurrentPhase()).toBe("suggestion");
    });

    it("should return null if no active cycle exists", async () => {
      // Mock dependencies
      vi.mocked(dtoModule.getActiveCycleInChannel).mockResolvedValue(null);

      // Execute
      const cycle = await Cycle.getActive("channel-123");

      // Assert
      expect(cycle).toBeNull();
    });
  });

  describe("update", () => {
    let cycle: Cycle;

    beforeEach(() => {
      const cycleId = new ObjectId();
      cycle = new Cycle(
        cycleId,
        "channel-123",
        "Test Cycle",
        new Date(),
        "active",
        {
          suggestion: 7,
          voting: 7,
          reading: 30,
          discussion: 7,
        },
        "suggestion"
      );
      vi.mocked(dtoModule.updateCycle).mockResolvedValue(1);
    });

    it("should update cycle properties", async () => {
      // Mock updateCycle to succeed
      vi.mocked(dtoModule.updateCycle).mockResolvedValue(1);

      // Execute
      const updatedCycle = await cycle.update({
        name: "Updated Cycle",
        currentPhase: "voting",
        status: "completed",
      });

      // Assert
      expect(dtoModule.updateCycle).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          _id: cycle.getId(),
          channelId: "channel-123",
          name: "Updated Cycle",
          currentPhase: "voting",
          status: "completed",
        })
      );
      expect(updatedCycle.getName()).toBe("Updated Cycle");
      expect(updatedCycle.getCurrentPhase()).toBe("voting");
      expect(updatedCycle.getStatus()).toBe("completed");
    });

    it("should throw an error if update fails", async () => {
      // Mock updateCycle to fail
      vi.mocked(dtoModule.updateCycle).mockResolvedValue(0);

      // Execute and assert
      await expect(cycle.update({ name: "Updated Cycle" })).rejects.toThrow(
        "Failed to save cycle configuration"
      );
    });

    it("should handle setting selectedBookId to null", async () => {
      // Mock updateCycle to succeed
      vi.mocked(dtoModule.updateCycle).mockResolvedValue(1);

      // Execute
      const updatedCycle = await cycle.update({ selectedBookId: null });

      // Assert
      expect(dtoModule.updateCycle).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          _id: cycle.getId(),
          channelId: "channel-123",
          selectedBookId: undefined,
        })
      );
      expect(updatedCycle.getSelectedBookId()).toBeUndefined();
    });

    it("should handle setting selectedBookId to a value", async () => {
      // Mock updateCycle to succeed
      vi.mocked(dtoModule.updateCycle).mockResolvedValue(1);
      const bookId = new ObjectId();

      // Execute
      const updatedCycle = await cycle.update({ selectedBookId: bookId });

      // Assert
      expect(dtoModule.updateCycle).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          _id: cycle.getId(),
          channelId: "channel-123",
          selectedBookId: bookId,
        })
      );
      expect(updatedCycle.getSelectedBookId()).toEqual(bookId);
    });

    it("should not update properties that are not provided", async () => {
      // Mock updateCycle to succeed
      vi.mocked(dtoModule.updateCycle).mockResolvedValue(1);

      // Execute
      await cycle.update({});

      // Assert
      expect(dtoModule.updateCycle).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          _id: cycle.getId(),
          channelId: "channel-123",
        })
      );
      // Object should not contain properties that weren't provided
      expect(dtoModule.updateCycle).not.toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          name: expect.anything(),
          currentPhase: expect.anything(),
          status: expect.anything(),
        })
      );
    });
  });

  describe("getters", () => {
    let cycle: Cycle;
    const cycleId = new ObjectId();
    const bookId = new ObjectId();
    const phaseTimings = {
      suggestion: {
        startDate: new Date("2023-01-01"),
        endDate: new Date("2023-01-08"),
      },
      voting: {
        startDate: new Date("2023-01-08"),
        endDate: new Date("2023-01-15"),
      },
      reading: {
        startDate: new Date("2023-01-15"),
        endDate: new Date("2023-02-15"),
      },
      discussion: { startDate: new Date("2023-02-15") },
    };

    beforeEach(() => {
      cycle = new Cycle(
        cycleId,
        "channel-123",
        "Test Cycle",
        new Date("2023-01-01"),
        "active",
        {
          suggestion: 7,
          voting: 7,
          reading: 30,
          discussion: 7,
        },
        "discussion",
        bookId,
        phaseTimings
      );
    });

    it("should return the cycle ID", () => {
      expect(cycle.getId()).toEqual(cycleId);
    });

    it("should return the channel ID", () => {
      expect(cycle.getChannelId()).toBe("channel-123");
    });

    it("should return the cycle name", () => {
      expect(cycle.getName()).toBe("Test Cycle");
    });

    it("should return the start date", () => {
      expect(cycle.getStartDate()).toEqual(new Date("2023-01-01"));
    });

    it("should return the status", () => {
      expect(cycle.getStatus()).toBe("active");
    });

    it("should return the phase durations", () => {
      expect(cycle.getPhaseDurations()).toEqual({
        suggestion: 7,
        voting: 7,
        reading: 30,
        discussion: 7,
      });
    });

    it("should return the current phase", () => {
      expect(cycle.getCurrentPhase()).toBe("discussion");
    });

    it("should return the selected book ID", () => {
      expect(cycle.getSelectedBookId()).toEqual(bookId);
    });

    it("should return the phase timings", () => {
      expect(cycle.getPhaseTimings()).toEqual(phaseTimings);
    });

    it("should return the current phase start date", () => {
      expect(cycle.getCurrentPhaseStartDate()).toEqual(new Date("2023-02-15"));
    });

    it("should return the current phase end date", () => {
      expect(cycle.getCurrentPhaseEndDate()).toBeUndefined();
    });
  });

  describe("getStats", () => {
    it("should return cycle statistics", async () => {
      // Setup
      const cycleId = new ObjectId();
      const cycle = new Cycle(
        cycleId,
        "channel-123",
        "Test Cycle",
        new Date(),
        "active",
        { suggestion: 7, voting: 7, reading: 30, discussion: 7 },
        "suggestion"
      );

      // Mock suggestions
      vi.mocked(dtoModule.getSuggestionsByCycle).mockResolvedValue([
        {
          _id: new ObjectId(),
          cycleId,
          bookName: "Book 1",
          author: "Author 1",
          userId: "user1",
          link: "https://example.com/book1",
          createdAt: new Date(),
          totalPoints: 3,
          voters: ["user1", "user2", "user3"],
        },
        {
          _id: new ObjectId(),
          cycleId,
          bookName: "Book 2",
          author: "Author 2",
          userId: "user2",
          link: "https://example.com/book2",
          createdAt: new Date(),
          totalPoints: 2,
          voters: ["user2", "user4"],
        },
      ]);

      // Execute
      const stats = await cycle.getStats();

      // Assert
      expect(dtoModule.getSuggestionsByCycle).toHaveBeenCalledWith(
        mockDb,
        cycleId
      );
      expect(stats).toEqual({
        totalSuggestions: 2,
        totalVotes: 4,
        participantCount: 4,
      });
    });

    it("should handle empty voters array", async () => {
      // Setup
      const cycleId = new ObjectId();
      const cycle = new Cycle(
        cycleId,
        "channel-123",
        "Test Cycle",
        new Date(),
        "active",
        { suggestion: 7, voting: 7, reading: 30, discussion: 7 },
        "suggestion"
      );

      // Mock suggestions with missing voters
      vi.mocked(dtoModule.getSuggestionsByCycle).mockResolvedValue([
        {
          _id: new ObjectId(),
          cycleId,
          bookName: "Book 1",
          author: "Author 1",
          userId: "user1",
          link: "https://example.com/book1",
          createdAt: new Date(),
          totalPoints: 0,
          voters: [],
        },
        {
          _id: new ObjectId(),
          cycleId,
          bookName: "Book 2",
          author: "Author 2",
          userId: "user2",
          link: "https://example.com/book2",
          createdAt: new Date(),
          totalPoints: 0,
          voters: [],
        },
      ]);

      // Execute
      const stats = await cycle.getStats();

      // Assert
      expect(stats).toEqual({
        totalSuggestions: 2,
        totalVotes: 0,
        participantCount: 0,
      });
    });
  });

  describe("phase timing methods", () => {
    let cycle: Cycle;
    const cycleId = new ObjectId();

    beforeEach(() => {
      cycle = new Cycle(
        cycleId,
        "channel-123",
        "Test Cycle",
        new Date("2023-01-01"),
        "active",
        {
          suggestion: 7,
          voting: 7,
          reading: 30,
          discussion: 7,
        },
        "reading",
        undefined,
        {
          suggestion: {
            startDate: new Date("2023-01-01"),
            endDate: new Date("2023-01-08"),
          },
          voting: {
            startDate: new Date("2023-01-08"),
            endDate: new Date("2023-01-15"),
          },
          reading: {
            startDate: new Date("2023-01-15"),
          },
          discussion: {},
        }
      );
      vi.mocked(dtoModule.updateCycle).mockResolvedValue(1);
    });

    it("should calculate current phase end date based on start date and duration", () => {
      // Set system time to match the cycle's reading phase start
      vi.setSystemTime(new Date("2023-01-15"));

      // Execute
      const endDate = cycle.calculateCurrentPhaseEndDate();

      // The reading phase is 30 days, so it should end on Feb 14
      expect(endDate).toEqual(new Date("2023-02-14"));
    });

    it("should return undefined when calculating end date with no start date", () => {
      // Create a cycle with no phase timings
      const cycleWithoutTimings = new Cycle(
        cycleId,
        "channel-123",
        "Test Cycle",
        new Date(),
        "active",
        { suggestion: 7, voting: 7, reading: 30, discussion: 7 },
        "reading"
      );

      // Execute
      const endDate = cycleWithoutTimings.calculateCurrentPhaseEndDate();

      // Assert
      expect(endDate).toBeUndefined();
    });

    it("should set current phase start date", async () => {
      // Set a specific time for the test
      const testDate = new Date("2023-01-20T12:00:00.000Z");
      vi.setSystemTime(testDate);

      // Execute
      const updatedCycle = await cycle.setCurrentPhaseStartDate();

      // Assert
      expect(dtoModule.updateCycle).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          phaseTimings: {
            suggestion: {
              startDate: new Date("2023-01-01"),
              endDate: new Date("2023-01-08"),
            },
            voting: {
              startDate: new Date("2023-01-08"),
              endDate: new Date("2023-01-15"),
            },
            reading: {
              startDate: testDate,
            },
            discussion: {},
          },
        })
      );

      // The result should reflect the changes
      const phaseTimings = updatedCycle.getPhaseTimings();
      expect(phaseTimings?.reading?.startDate).toEqual(testDate);
    });

    it("should set current phase end date", async () => {
      // Set a specific time for the test
      const testDate = new Date("2023-02-14T12:00:00.000Z");
      vi.setSystemTime(testDate);

      // Execute
      const updatedCycle = await cycle.setCurrentPhaseEndDate();

      // Assert
      expect(dtoModule.updateCycle).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          phaseTimings: {
            suggestion: {
              startDate: new Date("2023-01-01"),
              endDate: new Date("2023-01-08"),
            },
            voting: {
              startDate: new Date("2023-01-08"),
              endDate: new Date("2023-01-15"),
            },
            reading: {
              startDate: new Date("2023-01-15"),
              endDate: testDate,
            },
            discussion: {},
          },
        })
      );

      // The result should reflect the changes
      const phaseTimings = updatedCycle.getPhaseTimings();
      expect(phaseTimings?.reading?.endDate).toEqual(testDate);
    });

    it("should initialize phase timings when setting start/end date if none exist", async () => {
      // Create a cycle with no phase timings
      const cycleWithoutTimings = new Cycle(
        cycleId,
        "channel-123",
        "Test Cycle",
        new Date(),
        "active",
        { suggestion: 7, voting: 7, reading: 30, discussion: 7 },
        "suggestion"
      );

      // Set a specific time for the test
      const testDate = new Date("2023-01-01T12:00:00.000Z");
      vi.setSystemTime(testDate);

      // Mock update to succeed
      vi.mocked(dtoModule.updateCycle).mockResolvedValue(1);

      // Execute
      await cycleWithoutTimings.setCurrentPhaseStartDate();

      // Assert
      expect(dtoModule.updateCycle).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          phaseTimings: {
            suggestion: { startDate: testDate },
            voting: {},
            reading: {},
            discussion: {},
          },
        })
      );
    });
  });

  describe("getCurrentPhaseDeadline (deprecated)", () => {
    let cycle: Cycle;
    const cycleId = new ObjectId();
    const currentDate = new Date("2023-01-20T12:00:00.000Z");

    beforeEach(() => {
      vi.setSystemTime(currentDate);
    });

    it("should return persisted end date if available", () => {
      // Create cycle with persisted end date
      const endDate = new Date("2023-02-14T12:00:00.000Z");
      cycle = new Cycle(
        cycleId,
        "channel-123",
        "Test Cycle",
        new Date(),
        "active",
        { suggestion: 7, voting: 7, reading: 30, discussion: 7 },
        "reading",
        undefined,
        {
          suggestion: {},
          voting: {},
          reading: {
            startDate: new Date("2023-01-15"),
            endDate: endDate,
          },
          discussion: {},
        }
      );

      // Execute
      const deadline = cycle.getCurrentPhaseDeadline();

      // Assert
      expect(deadline).toEqual(endDate);
    });

    it("should calculate deadline from current date if no persisted end date", () => {
      // Create cycle without persisted end date
      cycle = new Cycle(
        cycleId,
        "channel-123",
        "Test Cycle",
        new Date(),
        "active",
        { suggestion: 7, voting: 7, reading: 30, discussion: 7 },
        "reading"
      );

      // Execute
      const deadline = cycle.getCurrentPhaseDeadline();

      // Assert: reading phase is 30 days from now
      const expectedDate = new Date(currentDate);
      expectedDate.setDate(expectedDate.getDate() + 30);
      expect(deadline).toEqual(expectedDate);
    });

    it("should fall back to default durations if phaseDurations is missing", () => {
      // Create cycle without phaseDurations
      cycle = new Cycle(
        cycleId,
        "channel-123",
        "Test Cycle",
        new Date(),
        "active",
        undefined as any,
        "suggestion"
      );

      // Mock getPhaseConfig
      vi.mocked(configModule.getPhaseConfig).mockReturnValue({
        suggestion: 10, // different from default
        voting: 7,
        reading: 30,
        discussion: 7,
      });

      // Execute
      const deadline = cycle.getCurrentPhaseDeadline();

      // Assert: suggestion phase is 10 days from now (from mocked config)
      const expectedDate = new Date(currentDate);
      expectedDate.setDate(expectedDate.getDate() + 10);
      expect(deadline).toEqual(expectedDate);
    });

    it("should fall back to 7 days if all else fails", () => {
      // Create cycle without phaseDurations
      cycle = new Cycle(
        cycleId,
        "channel-123",
        "Test Cycle",
        new Date(),
        "active",
        undefined as any,
        "unknown_phase" as any
      );

      // Mock getPhaseConfig to return no duration for the unknown phase
      vi.mocked(configModule.getPhaseConfig).mockReturnValue({
        suggestion: 7,
        voting: 7,
        reading: 30,
        discussion: 7,
        // unknown_phase is not in the config
      });

      // Execute
      const deadline = cycle.getCurrentPhaseDeadline();

      // Assert: default to 7 days
      const expectedDate = new Date(currentDate);
      expectedDate.setDate(expectedDate.getDate() + 7);
      expect(deadline).toEqual(expectedDate);
    });

    it("should use phase duration from getPhaseConfig when it's not in phaseDurations", () => {
      // Create cycle with phaseDurations that doesn't include the current phase
      cycle = new Cycle(
        cycleId,
        "channel-123",
        "Test Cycle",
        new Date(),
        "active",
        { suggestion: 7 } as any, // Only include suggestion phase
        "reading" // Current phase is reading, not in phaseDurations
      );

      // Mock getPhaseConfig to return a duration for the reading phase
      vi.mocked(configModule.getPhaseConfig).mockReturnValue({
        suggestion: 7,
        voting: 7,
        reading: 25, // Specific value to check
        discussion: 7,
      });

      // Execute
      const deadline = cycle.getCurrentPhaseDeadline();

      // Assert: reading phase is 25 days from now based on config
      const expectedDate = new Date(currentDate);
      expectedDate.setDate(expectedDate.getDate() + 25);
      expect(deadline).toEqual(expectedDate);
    });
  });
});
