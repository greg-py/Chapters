import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import {
  getActiveCycleInChannel,
  getAllActiveCycles,
  getCycleById,
  createCycle,
  updateCycle,
  deleteCycleById,
} from "./cycles";
import { COLLECTIONS } from "../db/constants";

// Mock MongoDB Db type
const mockDb = {
  collection: vi.fn(),
};

describe("Cycles DTO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getActiveCycleInChannel", () => {
    it("should return active cycle for a channel", async () => {
      // Setup
      const channelId = "channel-123";
      const mockCycle = {
        _id: new ObjectId(),
        channelId,
        status: "active",
      };

      const mockCollection = {
        findOne: vi.fn().mockResolvedValue(mockCycle),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getActiveCycleInChannel(mockDb as any, channelId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.CYCLES);
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        channelId,
        status: "active",
      });
      expect(result).toEqual(mockCycle);
    });

    it("should return null when no active cycle exists", async () => {
      // Setup
      const channelId = "channel-123";
      const mockCollection = {
        findOne: vi.fn().mockResolvedValue(null),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getActiveCycleInChannel(mockDb as any, channelId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getAllActiveCycles", () => {
    it("should return all active cycles", async () => {
      // Setup
      const mockCycles = [
        { _id: new ObjectId(), status: "active" },
        { _id: new ObjectId(), status: "active" },
      ];

      const mockCollection = {
        find: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockCycles),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getAllActiveCycles(mockDb as any);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.CYCLES);
      expect(mockCollection.find).toHaveBeenCalledWith({ status: "active" });
      expect(result).toEqual(mockCycles);
    });

    it("should return empty array when no active cycles exist", async () => {
      // Setup
      const mockCollection = {
        find: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getAllActiveCycles(mockDb as any);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getCycleById", () => {
    it("should return cycle by id", async () => {
      // Setup
      const cycleId = new ObjectId();
      const mockCycle = {
        _id: cycleId,
        status: "active",
      };

      const mockCollection = {
        findOne: vi.fn().mockResolvedValue(mockCycle),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getCycleById(mockDb as any, cycleId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.CYCLES);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: cycleId });
      expect(result).toEqual(mockCycle);
    });

    it("should return null when cycle not found", async () => {
      // Setup
      const cycleId = new ObjectId();
      const mockCollection = {
        findOne: vi.fn().mockResolvedValue(null),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await getCycleById(mockDb as any, cycleId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("createCycle", () => {
    it("should create a new cycle and return its id", async () => {
      // Setup
      const cycleId = new ObjectId();
      const cycleData = {
        channelId: "channel-123",
        status: "active",
      };

      const mockCollection = {
        insertOne: vi.fn().mockResolvedValue({ insertedId: cycleId }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await createCycle(mockDb as any, cycleData as any);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.CYCLES);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(cycleData);
      expect(result).toEqual(cycleId);
    });
  });

  describe("updateCycle", () => {
    it("should update cycle with $set operation", async () => {
      // Setup
      const cycleId = new ObjectId();
      const cycleData = {
        _id: cycleId,
        channelId: "channel-123",
        status: "active",
        name: "Updated Name",
      };

      const mockCollection = {
        updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await updateCycle(mockDb as any, cycleData as any);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.CYCLES);
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        {
          _id: cycleId,
          channelId: "channel-123",
        },
        {
          $set: cycleData,
        }
      );
      expect(result).toBe(1);
    });

    it("should handle unsetting selectedBookId", async () => {
      // Setup
      const cycleId = new ObjectId();
      const cycleData = {
        _id: cycleId,
        channelId: "channel-123",
        status: "active",
        selectedBookId: undefined,
      };

      const mockCollection = {
        updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await updateCycle(mockDb as any, cycleData as any);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.CYCLES);
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        {
          _id: cycleId,
          channelId: "channel-123",
        },
        {
          $set: { _id: cycleId, channelId: "channel-123", status: "active" },
          $unset: { selectedBookId: 1 },
        }
      );
      expect(result).toBe(1);
    });

    it("should include status filter when not updating status", async () => {
      // Setup
      const cycleId = new ObjectId();
      const cycleData = {
        _id: cycleId,
        channelId: "channel-123",
        name: "Updated Name",
      };

      const mockCollection = {
        updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await updateCycle(mockDb as any, cycleData as any);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.CYCLES);
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        {
          _id: cycleId,
          channelId: "channel-123",
          status: "active",
        },
        {
          $set: cycleData,
        }
      );
      expect(result).toBe(1);
    });

    it("should return 0 when no document is modified", async () => {
      // Setup
      const cycleId = new ObjectId();
      const cycleData = {
        _id: cycleId,
        channelId: "channel-123",
        status: "active",
      };

      const mockCollection = {
        updateOne: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await updateCycle(mockDb as any, cycleData as any);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe("deleteCycleById", () => {
    it("should delete cycle by id and return deleted count", async () => {
      // Setup
      const cycleId = new ObjectId();
      const mockCollection = {
        deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await deleteCycleById(mockDb as any, cycleId);

      // Assert
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.CYCLES);
      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ _id: cycleId });
      expect(result).toBe(1);
    });

    it("should return 0 when no document is deleted", async () => {
      // Setup
      const cycleId = new ObjectId();
      const mockCollection = {
        deleteOne: vi.fn().mockResolvedValue({ deletedCount: 0 }),
      };

      mockDb.collection.mockReturnValue(mockCollection);

      // Execute
      const result = await deleteCycleById(mockDb as any, cycleId);

      // Assert
      expect(result).toBe(0);
    });
  });
});
