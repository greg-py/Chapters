import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import {
  createVote,
  getVotesByUser,
  getVotesByCycle,
  deleteVotesByUser,
  deleteVotesByCycle,
} from "./votes";
import { COLLECTIONS } from "../db/constants";

// Mock MongoDB Db type
const mockDb = {
  collection: vi.fn(),
};

describe("Votes DTO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createVote", () => {
    it("should create a new vote and return its id", async () => {
      // Setup
      const voteId = new ObjectId();
      const voteData = {
        userId: "user-123",
        cycleId: new ObjectId(),
        firstChoice: "book1",
        secondChoice: "book2",
        thirdChoice: "book3",
        createdAt: new Date(),
      };

      const mockCollection = {
        insertOne: vi.fn().mockResolvedValue({ insertedId: voteId }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await createVote(mockDb as any, voteData);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.VOTES);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(voteData);
      expect(result).toEqual(voteId);
    });
  });

  describe("getVotesByUser", () => {
    it("should return all votes by a user for a cycle", async () => {
      // Setup
      const userId = "user-123";
      const cycleId = new ObjectId();
      const mockVotes = [
        { _id: new ObjectId(), userId, cycleId, firstChoice: "book1" },
        { _id: new ObjectId(), userId, cycleId, firstChoice: "book2" },
      ];

      const mockCollection = {
        find: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockVotes),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getVotesByUser(mockDb as any, userId, cycleId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.VOTES);
      expect(mockCollection.find).toHaveBeenCalledWith({ userId, cycleId });
      expect(result).toEqual(mockVotes);
    });

    it("should return empty array when no votes exist", async () => {
      // Setup
      const userId = "user-123";
      const cycleId = new ObjectId();
      const mockCollection = {
        find: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getVotesByUser(mockDb as any, userId, cycleId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getVotesByCycle", () => {
    it("should return all votes for a cycle", async () => {
      // Setup
      const cycleId = new ObjectId();
      const mockVotes = [
        { _id: new ObjectId(), cycleId, firstChoice: "book1" },
        { _id: new ObjectId(), cycleId, firstChoice: "book2" },
        { _id: new ObjectId(), cycleId, firstChoice: "book3" },
      ];

      const mockCollection = {
        find: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockVotes),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getVotesByCycle(mockDb as any, cycleId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.VOTES);
      expect(mockCollection.find).toHaveBeenCalledWith({ cycleId });
      expect(result).toEqual(mockVotes);
    });

    it("should return empty array when no votes exist", async () => {
      // Setup
      const cycleId = new ObjectId();
      const mockCollection = {
        find: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getVotesByCycle(mockDb as any, cycleId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("deleteVotesByUser", () => {
    it("should delete all votes by a user for a cycle and return deleted count", async () => {
      // Setup
      const userId = "user-123";
      const cycleId = new ObjectId();
      const mockCollection = {
        deleteMany: vi.fn().mockResolvedValue({ deletedCount: 2 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await deleteVotesByUser(mockDb as any, userId, cycleId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.VOTES);
      expect(mockCollection.deleteMany).toHaveBeenCalledWith({
        userId,
        cycleId,
      });
      expect(result).toBe(2);
    });

    it("should return 0 when no documents are deleted", async () => {
      // Setup
      const userId = "user-123";
      const cycleId = new ObjectId();
      const mockCollection = {
        deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await deleteVotesByUser(mockDb as any, userId, cycleId);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe("deleteVotesByCycle", () => {
    it("should delete all votes for a cycle and return deleted count", async () => {
      // Setup
      const cycleId = new ObjectId();
      const mockCollection = {
        deleteMany: vi.fn().mockResolvedValue({ deletedCount: 5 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await deleteVotesByCycle(mockDb as any, cycleId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.VOTES);
      expect(mockCollection.deleteMany).toHaveBeenCalledWith({ cycleId });
      expect(result).toBe(5);
    });

    it("should return 0 when no documents are deleted", async () => {
      // Setup
      const cycleId = new ObjectId();
      const mockCollection = {
        deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await deleteVotesByCycle(mockDb as any, cycleId);

      // Assert
      expect(result).toBe(0);
    });
  });
});
