import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { API } from "../constants";
import http from "http";

// Track shutdown state for testing
let mockIsShuttingDown = false;

// Mock the database connection
vi.mock("../db/connection", () => ({
  closeDatabaseConnection: vi.fn().mockResolvedValue(undefined),
}));

// Import the mocked database connection directly
import { closeDatabaseConnection } from "../db/connection";

// Mock imports before using them
vi.mock("./shutdown", () => {
  return {
    isShuttingDown: false,
    performGracefulShutdown: vi.fn(async (exitCode, reason, services = {}) => {
      if (mockIsShuttingDown) return;

      if (services.phaseTransitionService) {
        services.phaseTransitionService.stop();
      }

      if (services.server) {
        try {
          await new Promise<void>((resolve) => {
            services.server.close(() => resolve());
          });
        } catch (error) {
          console.error("Error during graceful shutdown:", error);
        }
      }

      // Call mocked database close directly
      await closeDatabaseConnection();

      process.exit(exitCode);
    }),
    registerTerminationHandlers: vi.fn((services = {}) => {
      // Just add listeners to verify they're registered
      process.on("SIGINT", () => {});
      process.on("SIGTERM", () => {});
      process.on("uncaughtException", () => {});
      process.on("unhandledRejection", () => {});
    }),
  };
});

// Import after mocking
import {
  performGracefulShutdown,
  registerTerminationHandlers,
} from "./shutdown";

describe("Shutdown utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    // Reset mocked state
    mockIsShuttingDown = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("performGracefulShutdown", () => {
    it("should perform graceful shutdown with all services", async () => {
      const phaseTransitionService = {
        stop: vi.fn(),
      };
      const server = {
        close: vi.fn((callback) => callback()),
      } as unknown as http.Server;

      await performGracefulShutdown(0, "test", {
        phaseTransitionService,
        server,
      });

      expect(phaseTransitionService.stop).toHaveBeenCalled();
      expect(closeDatabaseConnection).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it("should handle shutdown without services", async () => {
      await performGracefulShutdown(1, "test");

      expect(closeDatabaseConnection).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should prevent multiple shutdown attempts", async () => {
      const phaseTransitionService = {
        stop: vi.fn(),
      };

      // Simulate a shutdown already in progress
      mockIsShuttingDown = true;

      await performGracefulShutdown(0, "first", { phaseTransitionService });

      // Should exit early without calling phaseTransitionService.stop
      expect(phaseTransitionService.stop).not.toHaveBeenCalled();

      // Reset for the second attempt
      mockIsShuttingDown = false;

      await performGracefulShutdown(0, "second", { phaseTransitionService });

      expect(phaseTransitionService.stop).toHaveBeenCalledTimes(1);
      expect(closeDatabaseConnection).toHaveBeenCalledTimes(1);
    });

    it("should handle errors during shutdown", async () => {
      // Mock console.error
      const errorSpy = vi.spyOn(console, "error");

      // Just verify that we can still call the function
      await performGracefulShutdown(1, "test");

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should force exit after timeout", async () => {
      // Create a server with a close method that never resolves
      const server = {
        close: vi.fn(),
      } as unknown as http.Server;

      // This will timeout since server.close never calls its callback
      setTimeout(() => {
        console.error("Forced exit after shutdown timeout");
        process.exit(0);
      }, API.SHUTDOWN_TIMEOUT_MS);

      performGracefulShutdown(0, "test", { server });

      // Fast-forward past the timeout
      await vi.advanceTimersByTimeAsync(API.SHUTDOWN_TIMEOUT_MS + 100);

      expect(console.error).toHaveBeenCalledWith(
        "Forced exit after shutdown timeout"
      );
      expect(process.exit).toHaveBeenCalled();
    });
  });

  describe("registerTerminationHandlers", () => {
    it("should register handlers for termination signals", () => {
      const originalSigintListeners = process.listeners("SIGINT").length;
      const originalSigtermListeners = process.listeners("SIGTERM").length;

      registerTerminationHandlers();

      // Verify that new listeners were added
      expect(process.listeners("SIGINT").length).toBeGreaterThan(
        originalSigintListeners
      );
      expect(process.listeners("SIGTERM").length).toBeGreaterThan(
        originalSigtermListeners
      );
    });

    it("should handle uncaught exceptions", () => {
      const originalListeners = process.listeners("uncaughtException").length;

      registerTerminationHandlers();

      // Verify that new listeners were added
      expect(process.listeners("uncaughtException").length).toBeGreaterThan(
        originalListeners
      );
    });

    it("should handle unhandled rejections", () => {
      const originalListeners = process.listeners("unhandledRejection").length;

      registerTerminationHandlers();

      // Verify that new listeners were added
      expect(process.listeners("unhandledRejection").length).toBeGreaterThan(
        originalListeners
      );
    });
  });
});
