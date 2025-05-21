import { describe, it, expect, vi } from "vitest";
import { withErrorHandling, withActionErrorHandling } from "./errors";
import { WebClient } from "@slack/web-api";
import { BlockAction, ViewSubmitAction } from "@slack/bolt";

describe("Error utilities", () => {
  describe("withErrorHandling", () => {
    it("should call the handler with the provided args", async () => {
      const handler = vi.fn();
      const wrappedHandler = withErrorHandling(handler);
      const args = {
        ack: vi.fn(),
        client: {} as WebClient,
        command: {
          channel_id: "C123",
          user_id: "U123",
        },
      };

      await wrappedHandler(args);

      expect(handler).toHaveBeenCalledWith(args);
      expect(args.ack).toHaveBeenCalled();
    });

    it("should handle errors and send ephemeral message", async () => {
      const error = new Error("Test error");
      const handler = vi.fn().mockRejectedValue(error);
      const wrappedHandler = withErrorHandling(handler);
      const postEphemeral = vi.fn();
      const args = {
        ack: vi.fn(),
        client: {
          chat: {
            postEphemeral,
          },
        } as unknown as WebClient,
        command: {
          channel_id: "C123",
          user_id: "U123",
        },
      };

      await wrappedHandler(args);

      expect(postEphemeral).toHaveBeenCalledWith({
        channel: "C123",
        user: "U123",
        text: "❌ Error: Test error",
      });
    });

    it("should handle ack errors", async () => {
      const ackError = new Error("Ack error");
      const handler = vi.fn();
      const wrappedHandler = withErrorHandling(handler);
      const args = {
        ack: vi.fn().mockRejectedValue(ackError),
        client: {} as WebClient,
        command: {
          channel_id: "C123",
          user_id: "U123",
        },
      };

      await wrappedHandler(args);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe("withActionErrorHandling", () => {
    it("should call the handler with the provided args", async () => {
      const handler = vi.fn();
      const wrappedHandler = withActionErrorHandling(handler);
      const args = {
        ack: vi.fn(),
        client: {} as WebClient,
        body: {
          type: "block_actions",
          user: { id: "U123" },
          channel: { id: "C123" },
        } as BlockAction,
      };

      await wrappedHandler(args);

      expect(handler).toHaveBeenCalledWith(args);
      expect(args.ack).toHaveBeenCalled();
    });

    it("should handle errors and send ephemeral message for block actions", async () => {
      const error = new Error("Test error");
      const handler = vi.fn().mockRejectedValue(error);
      const wrappedHandler = withActionErrorHandling(handler);
      const postEphemeral = vi.fn();
      const args = {
        ack: vi.fn(),
        client: {
          chat: {
            postEphemeral,
          },
        } as unknown as WebClient,
        body: {
          type: "block_actions",
          user: { id: "U123" },
          channel: { id: "C123" },
        } as BlockAction,
      };

      await wrappedHandler(args);

      expect(postEphemeral).toHaveBeenCalledWith({
        channel: "C123",
        user: "U123",
        text: "❌ Error: Test error",
      });
    });

    it("should handle errors and send ephemeral message for view submissions", async () => {
      const error = new Error("Test error");
      const handler = vi.fn().mockRejectedValue(error);
      const wrappedHandler = withActionErrorHandling(handler);
      const postEphemeral = vi.fn();
      const args = {
        ack: vi.fn(),
        client: {
          chat: {
            postEphemeral,
          },
        } as unknown as WebClient,
        body: {
          type: "view_submission",
          user: { id: "U123" },
          view: {
            private_metadata: JSON.stringify({ channelId: "C123" }),
          },
        } as unknown as ViewSubmitAction,
      };

      await wrappedHandler(args);

      expect(postEphemeral).toHaveBeenCalledWith({
        channel: "C123",
        user: "U123",
        text: "❌ Error: Test error",
      });
    });

    it("should handle ack errors", async () => {
      const ackError = new Error("Ack error");
      const handler = vi.fn();
      const wrappedHandler = withActionErrorHandling(handler);
      const postEphemeral = vi.fn();
      const args = {
        ack: vi.fn().mockRejectedValue(ackError),
        client: {
          chat: {
            postEphemeral,
          },
        } as unknown as WebClient,
        body: {
          type: "block_actions",
          user: { id: "U123" },
          channel: { id: "C123" },
        } as BlockAction,
      };

      await wrappedHandler(args);

      expect(handler).not.toHaveBeenCalled();
      expect(postEphemeral).toHaveBeenCalledWith({
        channel: "C123",
        user: "U123",
        text: "❌ Error: Sorry, there was an issue processing your action.",
      });
    });
  });
});
