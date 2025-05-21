import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import {
  createSuggestion,
  getSuggestionsByCycle,
  getSuggestionById,
  updateSuggestion,
  deleteSuggestion,
  deleteSuggestionsByCycle,
} from "./suggestions";
import { COLLECTIONS } from "../db/constants";

// Mock MongoDB Db type
const mockDb = {
  collection: vi.fn(),
};

describe("Suggestions DTO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createSuggestion", () => {
    it("should create a new suggestion and return its id", async () => {
      // Setup
      const suggestionId = new ObjectId();
      const suggestionData = {
        cycleId: new ObjectId(),
        userId: "user-123",
        bookName: "Test Book",
        author: "Test Author",
      };

      const mockCollection = {
        insertOne: vi.fn().mockResolvedValue({ insertedId: suggestionId }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await createSuggestion(
        mockDb as any,
        suggestionData as any
      );

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.SUGGESTIONS);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(suggestionData);
      expect(result).toEqual(suggestionId);
    });
  });

  describe("getSuggestionsByCycle", () => {
    it("should return all suggestions for a cycle", async () => {
      // Setup
      const cycleId = new ObjectId();
      const mockSuggestions = [
        { _id: new ObjectId(), cycleId, bookName: "Book 1" },
        { _id: new ObjectId(), cycleId, bookName: "Book 2" },
      ];

      const mockCollection = {
        find: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockSuggestions),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getSuggestionsByCycle(mockDb as any, cycleId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.SUGGESTIONS);
      expect(mockCollection.find).toHaveBeenCalledWith({ cycleId });
      expect(result).toEqual(mockSuggestions);
    });

    it("should return empty array when no suggestions exist", async () => {
      // Setup
      const cycleId = new ObjectId();
      const mockCollection = {
        find: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getSuggestionsByCycle(mockDb as any, cycleId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getSuggestionById", () => {
    it("should return suggestion by id", async () => {
      // Setup
      const suggestionId = new ObjectId();
      const mockSuggestion = {
        _id: suggestionId,
        bookName: "Test Book",
      };

      const mockCollection = {
        findOne: vi.fn().mockResolvedValue(mockSuggestion),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getSuggestionById(mockDb as any, suggestionId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.SUGGESTIONS);
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        _id: suggestionId,
      });
      expect(result).toEqual(mockSuggestion);
    });

    it("should return null when suggestion not found", async () => {
      // Setup
      const suggestionId = new ObjectId();
      const mockCollection = {
        findOne: vi.fn().mockResolvedValue(null),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getSuggestionById(mockDb as any, suggestionId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("updateSuggestion", () => {
    it("should update suggestion and return modified count", async () => {
      // Setup
      const suggestionId = new ObjectId();
      const suggestionData = {
        _id: suggestionId,
        bookName: "Updated Book",
      };

      const mockCollection = {
        updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await updateSuggestion(
        mockDb as any,
        suggestionData as any
      );

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.SUGGESTIONS);
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: suggestionId },
        { $set: suggestionData }
      );
      expect(result).toBe(1);
    });

    it("should return 0 when no document is modified", async () => {
      // Setup
      const suggestionId = new ObjectId();
      const suggestionData = {
        _id: suggestionId,
        bookName: "Updated Book",
      };

      const mockCollection = {
        updateOne: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await updateSuggestion(
        mockDb as any,
        suggestionData as any
      );

      // Assert
      expect(result).toBe(0);
    });
  });

  describe("deleteSuggestion", () => {
    it("should delete suggestion and return deleted count", async () => {
      // Setup
      const suggestionId = new ObjectId();
      const mockCollection = {
        deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await deleteSuggestion(mockDb as any, suggestionId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.SUGGESTIONS);
      expect(mockCollection.deleteOne).toHaveBeenCalledWith({
        _id: suggestionId,
      });
      expect(result).toBe(1);
    });

    it("should return 0 when no document is deleted", async () => {
      // Setup
      const suggestionId = new ObjectId();
      const mockCollection = {
        deleteOne: vi.fn().mockResolvedValue({ deletedCount: 0 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await deleteSuggestion(mockDb as any, suggestionId);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe("deleteSuggestionsByCycle", () => {
    it("should delete all suggestions for a cycle and return deleted count", async () => {
      // Setup
      const cycleId = new ObjectId();
      const mockCollection = {
        deleteMany: vi.fn().mockResolvedValue({ deletedCount: 3 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await deleteSuggestionsByCycle(mockDb as any, cycleId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.SUGGESTIONS);
      expect(mockCollection.deleteMany).toHaveBeenCalledWith({ cycleId });
      expect(result).toBe(3);
    });

    it("should return 0 when no documents are deleted", async () => {
      // Setup
      const cycleId = new ObjectId();
      const mockCollection = {
        deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await deleteSuggestionsByCycle(mockDb as any, cycleId);

      // Assert
      expect(result).toBe(0);
    });
  });
});
