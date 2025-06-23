import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import {
  createRating,
  getRatingsByUser,
  getRatingsByCycle,
  deleteRatingsByUser,
  deleteRatingsByCycle,
} from "./ratings";
import { COLLECTIONS } from "../db/constants";

// Mock MongoDB Db type
const mockDb = {
  collection: vi.fn(),
};

describe("Ratings DTO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createRating", () => {
    it("should create a new rating and return its id", async () => {
      // Setup
      const ratingId = new ObjectId();
      const ratingData = {
        userId: "user-123",
        cycleId: new ObjectId(),
        bookId: new ObjectId(),
        rating: 8,
        recommend: true,
        createdAt: new Date(),
      };

      const mockCollection = {
        insertOne: vi.fn().mockResolvedValue({ insertedId: ratingId }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await createRating(mockDb as any, ratingData);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.RATINGS);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(ratingData);
      expect(result).toEqual(ratingId);
    });
  });

  describe("getRatingsByUser", () => {
    it("should retrieve ratings for a specific user and cycle", async () => {
      // Setup
      const userId = "user-123";
      const cycleId = new ObjectId();
      const mockRatings = [
        {
          _id: new ObjectId(),
          userId,
          cycleId,
          bookId: new ObjectId(),
          rating: 7,
          recommend: true,
          createdAt: new Date(),
        },
      ];

      const mockCollection = {
        find: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockRatings),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getRatingsByUser(mockDb as any, userId, cycleId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.RATINGS);
      expect(mockCollection.find).toHaveBeenCalledWith({ userId, cycleId });
      expect(result).toEqual(mockRatings);
    });
  });

  describe("getRatingsByCycle", () => {
    it("should retrieve all ratings for a specific cycle", async () => {
      // Setup
      const cycleId = new ObjectId();
      const mockRatings = [
        {
          _id: new ObjectId(),
          userId: "user-1",
          cycleId,
          bookId: new ObjectId(),
          rating: 8,
          recommend: true,
          createdAt: new Date(),
        },
        {
          _id: new ObjectId(),
          userId: "user-2",
          cycleId,
          bookId: new ObjectId(),
          rating: 6,
          recommend: false,
          createdAt: new Date(),
        },
      ];

      const mockCollection = {
        find: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockRatings),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getRatingsByCycle(mockDb as any, cycleId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.RATINGS);
      expect(mockCollection.find).toHaveBeenCalledWith({ cycleId });
      expect(result).toEqual(mockRatings);
    });
  });

  describe("deleteRatingsByUser", () => {
    it("should delete ratings for a specific user and cycle", async () => {
      // Setup
      const userId = "user-123";
      const cycleId = new ObjectId();
      const deletedCount = 2;

      const mockCollection = {
        deleteMany: vi.fn().mockResolvedValue({ deletedCount }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await deleteRatingsByUser(mockDb as any, userId, cycleId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.RATINGS);
      expect(mockCollection.deleteMany).toHaveBeenCalledWith({
        userId,
        cycleId,
      });
      expect(result).toEqual(deletedCount);
    });
  });

  describe("deleteRatingsByCycle", () => {
    it("should delete all ratings for a specific cycle", async () => {
      // Setup
      const cycleId = new ObjectId();
      const deletedCount = 5;

      const mockCollection = {
        deleteMany: vi.fn().mockResolvedValue({ deletedCount }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await deleteRatingsByCycle(mockDb as any, cycleId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.RATINGS);
      expect(mockCollection.deleteMany).toHaveBeenCalledWith({ cycleId });
      expect(result).toEqual(deletedCount);
    });
  });
});
