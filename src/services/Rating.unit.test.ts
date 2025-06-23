import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import type { Db } from "mongodb";

// Mock the database module
vi.mock("../db", () => ({
  connectToDatabase: vi.fn(),
}));

// Mock the DTO module
vi.mock("../dto", () => ({
  createRating: vi.fn(),
  getRatingsByCycle: vi.fn(),
  getRatingsByUser: vi.fn(),
}));

// Import after mocking to avoid circular dependencies
import { Rating } from "./Rating";
import * as dtoModule from "../dto";
import * as dbModule from "../db";

describe("Rating", () => {
  const mockDb = {} as Db;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbModule.connectToDatabase).mockResolvedValue(mockDb);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("submitRating", () => {
    it("should create a rating with the provided data", async () => {
      const ratingId = new ObjectId();
      vi.mocked(dtoModule.createRating).mockResolvedValue(ratingId);

      const ratingData = {
        userId: "user-123",
        cycleId: new ObjectId(),
        bookId: new ObjectId(),
        rating: 8,
        recommend: true,
      };

      const result = await Rating.submitRating(ratingData);

      expect(dtoModule.createRating).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          ...ratingData,
          createdAt: expect.any(Date),
        })
      );
      expect(result).toEqual(ratingId);
    });
  });

  describe("hasUserRatedInCycle", () => {
    it("should return true if user has rated in the cycle", async () => {
      const mockRatings = [
        {
          _id: new ObjectId(),
          userId: "user-123",
          cycleId: new ObjectId(),
          bookId: new ObjectId(),
          rating: 7,
          recommend: true,
          createdAt: new Date(),
        },
      ];

      vi.mocked(dtoModule.getRatingsByUser).mockResolvedValue(mockRatings);

      const result = await Rating.hasUserRatedInCycle(
        "user-123",
        new ObjectId()
      );

      expect(result).toBe(true);
    });

    it("should return false if user has not rated in the cycle", async () => {
      vi.mocked(dtoModule.getRatingsByUser).mockResolvedValue([]);

      const result = await Rating.hasUserRatedInCycle(
        "user-123",
        new ObjectId()
      );

      expect(result).toBe(false);
    });
  });

  describe("getStatsForCycle", () => {
    it("should return zero stats when no ratings exist", async () => {
      vi.mocked(dtoModule.getRatingsByCycle).mockResolvedValue([]);

      const result = await Rating.getStatsForCycle(new ObjectId());

      expect(result).toEqual({
        averageRating: 0,
        recommendationPercentage: 0,
        totalRatings: 0,
      });
    });

    it("should calculate correct stats when ratings exist", async () => {
      const mockRatings = [
        {
          _id: new ObjectId(),
          userId: "user-1",
          cycleId: new ObjectId(),
          bookId: new ObjectId(),
          rating: 8,
          recommend: true,
          createdAt: new Date(),
        },
        {
          _id: new ObjectId(),
          userId: "user-2",
          cycleId: new ObjectId(),
          bookId: new ObjectId(),
          rating: 6,
          recommend: false,
          createdAt: new Date(),
        },
        {
          _id: new ObjectId(),
          userId: "user-3",
          cycleId: new ObjectId(),
          bookId: new ObjectId(),
          rating: 9,
          recommend: true,
          createdAt: new Date(),
        },
      ];

      vi.mocked(dtoModule.getRatingsByCycle).mockResolvedValue(mockRatings);

      const result = await Rating.getStatsForCycle(new ObjectId());

      expect(result).toEqual({
        averageRating: 7.7, // (8 + 6 + 9) / 3 = 7.666... rounded to 7.7
        recommendationPercentage: 67, // 2 out of 3 recommend = 66.666... rounded to 67
        totalRatings: 3,
      });
    });
  });
});
