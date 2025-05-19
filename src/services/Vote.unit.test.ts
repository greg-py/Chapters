import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ObjectId, Db } from "mongodb";

// Mock dependencies
vi.mock("../db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue({} as Db),
}));

vi.mock("../dto", () => ({
  updateSuggestion: vi.fn(),
}));

// Mock Suggestion class
vi.mock("./Suggestion", () => ({
  Suggestion: {
    getById: vi.fn(),
    getAllForCycle: vi.fn(),
  },
}));

// Import after mocking to avoid circular dependencies
import { Vote } from "./Vote";
import { Suggestion } from "./Suggestion";
import * as dtoModule from "../dto";
import * as dbModule from "../db";

describe("Vote", () => {
  const mockDb = {} as Db;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbModule.connectToDatabase).mockResolvedValue(mockDb);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("submitVote", () => {
    it("should add points for all three choices", async () => {
      // Mock suggestion instances
      const firstSuggestion = {
        addRankedChoicePoints: vi.fn().mockResolvedValue({}),
      };
      const secondSuggestion = {
        addRankedChoicePoints: vi.fn().mockResolvedValue({}),
      };
      const thirdSuggestion = {
        addRankedChoicePoints: vi.fn().mockResolvedValue({}),
      };

      // Mock Suggestion.getById to return our mock suggestions
      vi.mocked(Suggestion.getById)
        .mockResolvedValueOnce(firstSuggestion as any)
        .mockResolvedValueOnce(secondSuggestion as any)
        .mockResolvedValueOnce(thirdSuggestion as any);

      // Execute
      await Vote.submitVote({
        userId: "user-123",
        cycleId: new ObjectId(),
        firstChoice: "507f1f77bcf86cd799439011", // Valid ObjectId string
        secondChoice: "507f1f77bcf86cd799439012", // Valid ObjectId string
        thirdChoice: "507f1f77bcf86cd799439013", // Valid ObjectId string
      });

      // Assert
      expect(Suggestion.getById).toHaveBeenCalledTimes(3);
      expect(firstSuggestion.addRankedChoicePoints).toHaveBeenCalledWith(
        3,
        "user-123"
      );
      expect(secondSuggestion.addRankedChoicePoints).toHaveBeenCalledWith(
        2,
        "user-123"
      );
      expect(thirdSuggestion.addRankedChoicePoints).toHaveBeenCalledWith(
        1,
        "user-123"
      );
    });

    it("should handle missing second and third choices", async () => {
      // Mock suggestion instance
      const firstSuggestion = {
        addRankedChoicePoints: vi.fn().mockResolvedValue({}),
      };

      // Mock Suggestion.getById to return our mock suggestion
      vi.mocked(Suggestion.getById).mockResolvedValueOnce(
        firstSuggestion as any
      );

      // Execute
      await Vote.submitVote({
        userId: "user-123",
        cycleId: new ObjectId(),
        firstChoice: "507f1f77bcf86cd799439011", // Valid ObjectId string
        secondChoice: null,
        thirdChoice: null,
      });

      // Assert
      expect(Suggestion.getById).toHaveBeenCalledTimes(1);
      expect(firstSuggestion.addRankedChoicePoints).toHaveBeenCalledWith(
        3,
        "user-123"
      );
    });

    it("should handle non-existent suggestions", async () => {
      // Mock Suggestion.getById to return null for all calls
      vi.mocked(Suggestion.getById).mockResolvedValue(null);

      // Execute
      await Vote.submitVote({
        userId: "user-123",
        cycleId: new ObjectId(),
        firstChoice: "507f1f77bcf86cd799439011", // Valid ObjectId string
        secondChoice: "507f1f77bcf86cd799439012", // Valid ObjectId string
        thirdChoice: "507f1f77bcf86cd799439013", // Valid ObjectId string
      });

      // Assert
      expect(Suggestion.getById).toHaveBeenCalledTimes(3);
      // No errors should be thrown
    });

    it("should handle errors from addRankedChoicePoints", async () => {
      // Mock suggestion instance that throws an error
      const firstSuggestion = {
        addRankedChoicePoints: vi
          .fn()
          .mockRejectedValue(new Error("Test error")),
      };

      // Mock Suggestion.getById to return our mock suggestion
      vi.mocked(Suggestion.getById).mockResolvedValueOnce(
        firstSuggestion as any
      );

      // Execute and assert
      await expect(
        Vote.submitVote({
          userId: "user-123",
          cycleId: new ObjectId(),
          firstChoice: "507f1f77bcf86cd799439011", // Valid ObjectId string
          secondChoice: null,
          thirdChoice: null,
        })
      ).rejects.toThrow("Test error");
    });
  });

  describe("resetVotesForCycle", () => {
    it("should reset votes for all suggestions in a cycle", async () => {
      // Mock suggestions with valid ObjectIds
      const suggestionId1 = new ObjectId();
      const suggestionId2 = new ObjectId();
      const suggestions = [
        {
          getId: vi.fn().mockReturnValue(suggestionId1),
        },
        {
          getId: vi.fn().mockReturnValue(suggestionId2),
        },
      ];

      // Mock dependencies
      vi.mocked(Suggestion.getAllForCycle).mockResolvedValue(
        suggestions as any
      );
      vi.mocked(dtoModule.updateSuggestion)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      // Execute
      const result = await Vote.resetVotesForCycle(new ObjectId());

      // Assert
      expect(Suggestion.getAllForCycle).toHaveBeenCalled();
      expect(dtoModule.updateSuggestion).toHaveBeenCalledTimes(2);
      expect(dtoModule.updateSuggestion).toHaveBeenCalledWith(mockDb, {
        _id: suggestionId1,
        totalPoints: 0,
        voters: [],
      });
      expect(dtoModule.updateSuggestion).toHaveBeenCalledWith(mockDb, {
        _id: suggestionId2,
        totalPoints: 0,
        voters: [],
      });
      expect(result).toBe(2); // Both updates were successful
    });

    it("should handle empty suggestion list", async () => {
      // Mock empty suggestions list
      vi.mocked(Suggestion.getAllForCycle).mockResolvedValue([]);

      // Execute
      const result = await Vote.resetVotesForCycle(new ObjectId());

      // Assert
      expect(Suggestion.getAllForCycle).toHaveBeenCalled();
      expect(dtoModule.updateSuggestion).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should handle failed updates", async () => {
      // Mock suggestions with valid ObjectIds
      const suggestionId1 = new ObjectId();
      const suggestionId2 = new ObjectId();
      const suggestions = [
        {
          getId: vi.fn().mockReturnValue(suggestionId1),
        },
        {
          getId: vi.fn().mockReturnValue(suggestionId2),
        },
      ];

      // Mock dependencies
      vi.mocked(Suggestion.getAllForCycle).mockResolvedValue(
        suggestions as any
      );
      vi.mocked(dtoModule.updateSuggestion)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0); // Second update fails

      // Execute
      const result = await Vote.resetVotesForCycle(new ObjectId());

      // Assert
      expect(Suggestion.getAllForCycle).toHaveBeenCalled();
      expect(dtoModule.updateSuggestion).toHaveBeenCalledTimes(2);
      expect(result).toBe(1); // Only one update was successful
    });

    it("should handle errors from getAllForCycle", async () => {
      // Mock error from getAllForCycle
      vi.mocked(Suggestion.getAllForCycle).mockRejectedValue(
        new Error("Test error")
      );

      // Execute and assert
      await expect(Vote.resetVotesForCycle(new ObjectId())).rejects.toThrow(
        "Test error"
      );
    });
  });
});
