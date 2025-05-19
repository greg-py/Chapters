import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ObjectId, Db } from "mongodb";

// Mock dependencies
vi.mock("../db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue({} as Db),
}));

vi.mock("../dto", () => ({
  createSuggestion: vi.fn(),
  getSuggestionById: vi.fn(),
  getSuggestionsByCycle: vi.fn(),
  updateSuggestion: vi.fn(),
  deleteSuggestion: vi.fn(),
}));

// Import after mocking to avoid circular dependencies
import { Suggestion } from "./Suggestion";
import * as dtoModule from "../dto";
import * as dbModule from "../db";

describe("Suggestion", () => {
  const mockDate = new Date("2023-01-01T00:00:00.000Z");
  const mockDb = {} as Db;

  vi.useFakeTimers();
  vi.setSystemTime(mockDate);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbModule.connectToDatabase).mockResolvedValue(mockDb);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("static createNew", () => {
    it("should create a new suggestion with provided data", async () => {
      // Mock dependencies
      const mockObjectId = new ObjectId();
      vi.mocked(dtoModule.createSuggestion).mockResolvedValue(mockObjectId);

      // Execute
      const suggestion = await Suggestion.createNew(
        new ObjectId(),
        "user-123",
        "Test Book",
        "Test Author",
        "https://example.com",
        "Test notes"
      );

      // Assert
      expect(dtoModule.createSuggestion).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          cycleId: expect.any(ObjectId),
          userId: "user-123",
          bookName: "Test Book",
          author: "Test Author",
          link: "https://example.com",
          notes: "Test notes",
          createdAt: mockDate,
          totalPoints: 0,
          voters: [],
        })
      );
      expect(suggestion).toBeInstanceOf(Suggestion);
      expect(suggestion.getBookName()).toBe("Test Book");
      expect(suggestion.getAuthor()).toBe("Test Author");
      expect(suggestion.getLink()).toBe("https://example.com");
      expect(suggestion.getNotes()).toBe("Test notes");
      expect(suggestion.getTotalPoints()).toBe(0);
      expect(suggestion.getVoters()).toEqual([]);
    });

    it("should create a suggestion without notes if not provided", async () => {
      // Mock dependencies
      const mockObjectId = new ObjectId();
      vi.mocked(dtoModule.createSuggestion).mockResolvedValue(mockObjectId);

      // Execute
      const suggestion = await Suggestion.createNew(
        new ObjectId(),
        "user-123",
        "Test Book",
        "Test Author",
        "https://example.com"
      );

      // Assert
      expect(dtoModule.createSuggestion).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          notes: undefined,
        })
      );
      expect(suggestion.getNotes()).toBeUndefined();
    });
  });

  describe("static getById", () => {
    it("should return a suggestion by ID", async () => {
      // Mock dependencies
      const mockSuggestionData = {
        _id: new ObjectId(),
        cycleId: new ObjectId(),
        userId: "user-123",
        bookName: "Test Book",
        author: "Test Author",
        link: "https://example.com",
        notes: "Test notes",
        createdAt: mockDate,
        totalPoints: 5,
        voters: ["user1", "user2"],
      };
      vi.mocked(dtoModule.getSuggestionById).mockResolvedValue(
        mockSuggestionData
      );

      // Execute
      const suggestion = await Suggestion.getById(mockSuggestionData._id);

      // Assert
      expect(dtoModule.getSuggestionById).toHaveBeenCalledWith(
        mockDb,
        mockSuggestionData._id
      );
      expect(suggestion).toBeInstanceOf(Suggestion);
      expect(suggestion?.getId()).toEqual(mockSuggestionData._id);
      expect(suggestion?.getBookName()).toBe("Test Book");
      expect(suggestion?.getTotalPoints()).toBe(5);
      expect(suggestion?.getVoters()).toEqual(["user1", "user2"]);
    });

    it("should return null if suggestion not found", async () => {
      // Mock dependencies
      vi.mocked(dtoModule.getSuggestionById).mockResolvedValue(null);

      // Execute
      const suggestion = await Suggestion.getById(new ObjectId());

      // Assert
      expect(suggestion).toBeNull();
    });
  });

  describe("static getAllForCycle", () => {
    it("should return all suggestions for a cycle", async () => {
      // Mock dependencies
      const cycleId = new ObjectId();
      const mockSuggestions = [
        {
          _id: new ObjectId(),
          cycleId,
          userId: "user1",
          bookName: "Book 1",
          author: "Author 1",
          link: "https://example.com/book1",
          notes: "Notes 1",
          createdAt: mockDate,
          totalPoints: 3,
          voters: ["user1", "user2"],
        },
        {
          _id: new ObjectId(),
          cycleId,
          userId: "user2",
          bookName: "Book 2",
          author: "Author 2",
          link: "https://example.com/book2",
          notes: "Notes 2",
          createdAt: mockDate,
          totalPoints: 2,
          voters: ["user3"],
        },
      ];
      vi.mocked(dtoModule.getSuggestionsByCycle).mockResolvedValue(
        mockSuggestions
      );

      // Execute
      const suggestions = await Suggestion.getAllForCycle(cycleId);

      // Assert
      expect(dtoModule.getSuggestionsByCycle).toHaveBeenCalledWith(
        mockDb,
        cycleId
      );
      expect(suggestions).toHaveLength(2);
      expect(suggestions[0]).toBeInstanceOf(Suggestion);
      expect(suggestions[1]).toBeInstanceOf(Suggestion);
      expect(suggestions[0].getBookName()).toBe("Book 1");
      expect(suggestions[1].getBookName()).toBe("Book 2");
    });

    it("should return empty array if no suggestions found", async () => {
      // Mock dependencies
      vi.mocked(dtoModule.getSuggestionsByCycle).mockResolvedValue([]);

      // Execute
      const suggestions = await Suggestion.getAllForCycle(new ObjectId());

      // Assert
      expect(suggestions).toEqual([]);
    });
  });

  describe("static hasUserVotedInCycle", () => {
    it("should return true if user has voted in cycle", async () => {
      // Mock dependencies
      const cycleId = new ObjectId();
      const mockSuggestions = [
        {
          _id: new ObjectId(),
          cycleId,
          userId: "user1",
          bookName: "Book 1",
          author: "Author 1",
          link: "https://example.com/book1",
          createdAt: mockDate,
          totalPoints: 3,
          voters: ["user1", "user2"],
        },
        {
          _id: new ObjectId(),
          cycleId,
          userId: "user2",
          bookName: "Book 2",
          author: "Author 2",
          link: "https://example.com/book2",
          createdAt: mockDate,
          totalPoints: 2,
          voters: ["user3"],
        },
      ];
      vi.mocked(dtoModule.getSuggestionsByCycle).mockResolvedValue(
        mockSuggestions
      );

      // Execute
      const hasVoted = await Suggestion.hasUserVotedInCycle("user1", cycleId);

      // Assert
      expect(hasVoted).toBe(true);
    });

    it("should return false if user has not voted in cycle", async () => {
      // Mock dependencies
      const cycleId = new ObjectId();
      const mockSuggestions = [
        {
          _id: new ObjectId(),
          cycleId,
          userId: "user1",
          bookName: "Book 1",
          author: "Author 1",
          link: "https://example.com/book1",
          createdAt: mockDate,
          totalPoints: 3,
          voters: ["user1", "user2"],
        },
      ];
      vi.mocked(dtoModule.getSuggestionsByCycle).mockResolvedValue(
        mockSuggestions
      );

      // Execute
      const hasVoted = await Suggestion.hasUserVotedInCycle("user3", cycleId);

      // Assert
      expect(hasVoted).toBe(false);
    });

    it("should handle suggestions with undefined voters", async () => {
      // Mock dependencies
      const cycleId = new ObjectId();
      const mockSuggestions = [
        {
          _id: new ObjectId(),
          cycleId,
          userId: "user1",
          bookName: "Book 1",
          author: "Author 1",
          link: "https://example.com/book1",
          createdAt: mockDate,
          totalPoints: 0,
          voters: [],
        },
      ];
      vi.mocked(dtoModule.getSuggestionsByCycle).mockResolvedValue(
        mockSuggestions
      );

      // Execute
      const hasVoted = await Suggestion.hasUserVotedInCycle("user1", cycleId);

      // Assert
      expect(hasVoted).toBe(false);
    });
  });

  describe("addRankedChoicePoints", () => {
    let suggestion: Suggestion;

    beforeEach(() => {
      suggestion = new Suggestion(
        new ObjectId(),
        new ObjectId(),
        "user-123",
        "Test Book",
        "Test Author",
        "https://example.com",
        "Test notes",
        mockDate,
        0,
        []
      );
      vi.mocked(dtoModule.updateSuggestion).mockResolvedValue(1);
    });

    it("should add points and voter to suggestion", async () => {
      // Execute
      const updatedSuggestion = await suggestion.addRankedChoicePoints(
        3,
        "voter-123"
      );

      // Assert
      expect(dtoModule.updateSuggestion).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          _id: suggestion.getId(),
          totalPoints: 3,
          voters: ["voter-123"],
        })
      );
      expect(updatedSuggestion.getTotalPoints()).toBe(3);
      expect(updatedSuggestion.getVoters()).toEqual(["voter-123"]);
    });

    it("should throw error if update fails", async () => {
      // Mock update to fail
      vi.mocked(dtoModule.updateSuggestion).mockResolvedValue(0);

      // Execute and assert
      await expect(
        suggestion.addRankedChoicePoints(3, "voter-123")
      ).rejects.toThrow("Failed to update vote points");
    });
  });

  describe("delete", () => {
    let suggestion: Suggestion;

    beforeEach(() => {
      suggestion = new Suggestion(
        new ObjectId(),
        new ObjectId(),
        "user-123",
        "Test Book",
        "Test Author",
        "https://example.com",
        "Test notes",
        mockDate
      );
      vi.mocked(dtoModule.deleteSuggestion).mockResolvedValue(1);
    });

    it("should delete suggestion and return true", async () => {
      // Execute
      const result = await suggestion.delete();

      // Assert
      expect(dtoModule.deleteSuggestion).toHaveBeenCalledWith(
        mockDb,
        suggestion.getId()
      );
      expect(result).toBe(true);
    });

    it("should return false if deletion fails", async () => {
      // Mock deletion to fail
      vi.mocked(dtoModule.deleteSuggestion).mockResolvedValue(0);

      // Execute
      const result = await suggestion.delete();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("getters", () => {
    let suggestion: Suggestion;
    const suggestionId = new ObjectId();
    const cycleId = new ObjectId();

    beforeEach(() => {
      suggestion = new Suggestion(
        suggestionId,
        cycleId,
        "user-123",
        "Test Book",
        "Test Author",
        "https://example.com",
        "Test notes",
        mockDate,
        5,
        ["user1", "user2"]
      );
    });

    it("should return the suggestion ID", () => {
      expect(suggestion.getId()).toEqual(suggestionId);
    });

    it("should return the cycle ID", () => {
      expect(suggestion.getCycleId()).toEqual(cycleId);
    });

    it("should return the user ID", () => {
      expect(suggestion.getUserId()).toBe("user-123");
    });

    it("should return the book name", () => {
      expect(suggestion.getBookName()).toBe("Test Book");
    });

    it("should return the author", () => {
      expect(suggestion.getAuthor()).toBe("Test Author");
    });

    it("should return the link", () => {
      expect(suggestion.getLink()).toBe("https://example.com");
    });

    it("should return the notes", () => {
      expect(suggestion.getNotes()).toBe("Test notes");
    });

    it("should return the creation date", () => {
      expect(suggestion.getCreatedAt()).toEqual(mockDate);
    });

    it("should return the total points", () => {
      expect(suggestion.getTotalPoints()).toBe(5);
    });

    it("should return the voters", () => {
      expect(suggestion.getVoters()).toEqual(["user1", "user2"]);
    });
  });

  describe("formatForDisplay", () => {
    it("should format suggestion data for display", () => {
      const suggestion = new Suggestion(
        new ObjectId(),
        new ObjectId(),
        "user-123",
        "Test Book",
        "Test Author",
        "https://example.com",
        "Test notes",
        mockDate
      );

      const formatted = suggestion.formatForDisplay();

      expect(formatted).toEqual({
        bookName: "Test Book",
        author: "Test Author",
        link: "https://example.com",
        notes: "Test notes",
      });
    });

    it("should handle missing link and notes", () => {
      const suggestion = new Suggestion(
        new ObjectId(),
        new ObjectId(),
        "user-123",
        "Test Book",
        "Test Author",
        "",
        undefined,
        mockDate
      );

      const formatted = suggestion.formatForDisplay();

      expect(formatted).toEqual({
        bookName: "Test Book",
        author: "Test Author",
        link: "Not provided",
        notes: "Not provided",
      });
    });
  });
});
