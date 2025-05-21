import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import { resolveTiesAndSelectWinner } from "./voting";
import { Suggestion } from "../services";

// Override the Suggestion type for testing
vi.mock("../services", () => ({
  Suggestion: class MockSuggestion {},
}));

// Create a typed mock suggestion
const createMockSuggestion = (overrides = {}): Suggestion => {
  const mockSuggestion = {
    getId: vi.fn().mockReturnValue(new ObjectId()),
    getBookName: vi.fn().mockReturnValue("Mock Book"),
    getAuthor: vi.fn().mockReturnValue("Mock Author"),
    getTotalPoints: vi.fn().mockReturnValue(0),
    getVoters: vi.fn().mockReturnValue([]),
    // Add other required methods to match Suggestion interface
    getCycleId: vi.fn().mockReturnValue(new ObjectId()),
    getUserId: vi.fn().mockReturnValue("mock-user"),
    getLink: vi.fn().mockReturnValue("https://example.com"),
    getNotes: vi.fn().mockReturnValue("Mock notes"),
    getCreatedAt: vi.fn().mockReturnValue(new Date()),
    formatForDisplay: vi.fn(),
    addRankedChoicePoints: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };

  return mockSuggestion as unknown as Suggestion;
};

describe("Voting utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset Math.random to ensure predictable results for tests
    const mockRandom = vi.spyOn(Math, "random");
    // Set it to return 0.3 by default so we can predict which item will be selected randomly
    mockRandom.mockReturnValue(0.3);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("resolveTiesAndSelectWinner", () => {
    it("should return null if no suggestions are provided", () => {
      // Execute
      const result = resolveTiesAndSelectWinner([]);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null if suggestions parameter is null or undefined", () => {
      // Execute
      const result1 = resolveTiesAndSelectWinner(null as any);
      const result2 = resolveTiesAndSelectWinner(undefined as any);

      // Assert
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it("should return null if no votes have been cast", () => {
      // Setup
      const suggestions = [
        createMockSuggestion({ getTotalPoints: vi.fn().mockReturnValue(0) }),
        createMockSuggestion({ getTotalPoints: vi.fn().mockReturnValue(0) }),
      ];

      // Execute
      const result = resolveTiesAndSelectWinner(suggestions);

      // Assert
      expect(result).toBeNull();
    });

    it("should select the book with highest points when there is a clear winner", () => {
      // Setup
      const winningId = new ObjectId();
      const winner = createMockSuggestion({
        getId: vi.fn().mockReturnValue(winningId),
        getTotalPoints: vi.fn().mockReturnValue(5),
        getVoters: vi.fn().mockReturnValue(["user1", "user2"]),
      });

      const loser = createMockSuggestion({
        getTotalPoints: vi.fn().mockReturnValue(3),
        getVoters: vi.fn().mockReturnValue(["user3"]),
      });

      // Execute
      const result = resolveTiesAndSelectWinner([winner, loser]);

      // Assert
      expect(result).toBe(winner);
      expect(winner.getId).toHaveBeenCalled();
      expect(winner.getTotalPoints).toHaveBeenCalled();
      expect(loser.getTotalPoints).toHaveBeenCalled();
    });

    it("should break tie based on the number of unique voters", () => {
      // Setup
      const winningId = new ObjectId();
      const moreVoters = createMockSuggestion({
        getId: vi.fn().mockReturnValue(winningId),
        getTotalPoints: vi.fn().mockReturnValue(5), // Same points
        getVoters: vi.fn().mockReturnValue(["user1", "user2", "user3"]), // But more voters
      });

      const fewerVoters = createMockSuggestion({
        getTotalPoints: vi.fn().mockReturnValue(5), // Same points
        getVoters: vi.fn().mockReturnValue(["user4", "user5"]), // Fewer voters
      });

      // Execute
      const result = resolveTiesAndSelectWinner([moreVoters, fewerVoters]);

      // Assert
      expect(result).toBe(moreVoters);
      expect(moreVoters.getVoters).toHaveBeenCalled();
      expect(fewerVoters.getVoters).toHaveBeenCalled();
    });

    it("should randomly select a winner if tied in both points and unique voters", () => {
      // Setup
      const suggestion1Id = new ObjectId();
      const suggestion1 = createMockSuggestion({
        getId: vi.fn().mockReturnValue(suggestion1Id),
        getTotalPoints: vi.fn().mockReturnValue(5), // Same points
        getVoters: vi.fn().mockReturnValue(["user1", "user2"]), // Same number of voters
      });

      const suggestion2Id = new ObjectId();
      const suggestion2 = createMockSuggestion({
        getId: vi.fn().mockReturnValue(suggestion2Id),
        getTotalPoints: vi.fn().mockReturnValue(5), // Same points
        getVoters: vi.fn().mockReturnValue(["user3", "user4"]), // Same number of voters
      });

      const suggestion3Id = new ObjectId();
      const suggestion3 = createMockSuggestion({
        getId: vi.fn().mockReturnValue(suggestion3Id),
        getTotalPoints: vi.fn().mockReturnValue(5), // Same points
        getVoters: vi.fn().mockReturnValue(["user5", "user6"]), // Same number of voters
      });

      // With Math.random mocked to return 0.3, should select the first item
      // in a 3-item array (since Math.floor(0.3 * 3) = 0)
      const result1 = resolveTiesAndSelectWinner([
        suggestion1,
        suggestion2,
        suggestion3,
      ]);
      expect(result1).toBe(suggestion1);

      // Now mock to select the second item
      vi.spyOn(Math, "random").mockReturnValue(0.5); // Math.floor(0.5 * 3) = 1
      const result2 = resolveTiesAndSelectWinner([
        suggestion1,
        suggestion2,
        suggestion3,
      ]);
      expect(result2).toBe(suggestion2);

      // Now mock to select the third item
      vi.spyOn(Math, "random").mockReturnValue(0.8); // Math.floor(0.8 * 3) = 2
      const result3 = resolveTiesAndSelectWinner([
        suggestion1,
        suggestion2,
        suggestion3,
      ]);
      expect(result3).toBe(suggestion3);
    });

    it("should handle a custom log prefix", () => {
      // Setup
      const consoleSpy = vi.spyOn(console, "log");
      const winner = createMockSuggestion({
        getTotalPoints: vi.fn().mockReturnValue(5),
      });

      // Execute
      resolveTiesAndSelectWinner([winner], "TEST-PREFIX: ");

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("TEST-PREFIX: ")
      );
    });

    it("should correctly handle case where some tied books have equal number of voters", () => {
      // Setup
      const winner = createMockSuggestion({
        getTotalPoints: vi.fn().mockReturnValue(10),
        getVoters: vi.fn().mockReturnValue(["user1", "user2", "user3"]), // 3 voters
      });

      const tied1 = createMockSuggestion({
        getTotalPoints: vi.fn().mockReturnValue(10),
        getVoters: vi.fn().mockReturnValue(["user4", "user5"]), // 2 voters
      });

      const tied2 = createMockSuggestion({
        getTotalPoints: vi.fn().mockReturnValue(10),
        getVoters: vi.fn().mockReturnValue(["user6", "user7"]), // Also 2 voters
      });

      // Execute - should select winner since it has more voters
      const result = resolveTiesAndSelectWinner([tied1, winner, tied2]);

      // Assert
      expect(result).toBe(winner);
    });
  });
});
