import { describe, it, expect, vi } from "vitest";
import {
  createExpressReceiver,
  configureExpressApp,
  ExpressApp,
} from "./server";
import { ExpressReceiver } from "@slack/bolt";
import { Request, Response } from "express";
import { SlackEndpoints, Security, API } from "../constants";
import { getAppVersion } from "./version";

// Mock the version utility
vi.mock("./version", () => ({
  getAppVersion: vi.fn().mockReturnValue("1.0.0"),
}));

describe("Server utilities", () => {
  describe("createExpressReceiver", () => {
    it("should create an ExpressReceiver with correct configuration", () => {
      const signingSecret = "test-secret";
      const receiver = createExpressReceiver(signingSecret);

      expect(receiver).toBeInstanceOf(ExpressReceiver);
      expect(receiver.app).toBeDefined();
    });

    it("should configure the Express app with security middleware and routes", () => {
      const signingSecret = "test-secret";
      const receiver = createExpressReceiver(signingSecret);
      const app = receiver.app;

      // Mock the Express app methods
      const getSpy = vi.fn();
      const useSpy = vi.fn();
      app.get = getSpy;
      app.use = useSpy;

      // Call configureExpressApp
      configureExpressApp(app);

      // Verify security middleware was added
      expect(useSpy).toHaveBeenCalled();
      const middleware = useSpy.mock.calls[0][0];
      const req = {} as Request;
      const res = {
        setHeader: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      middleware(req, res, next);

      // Verify security headers were set
      expect(res.setHeader).toHaveBeenCalledWith(
        Security.HEADERS.CONTENT_TYPE_OPTIONS,
        Security.HEADER_VALUES.NO_SNIFF
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        Security.HEADERS.FRAME_OPTIONS,
        Security.HEADER_VALUES.DENY_FRAMES
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        Security.HEADERS.XSS_PROTECTION,
        Security.HEADER_VALUES.BLOCK_XSS
      );
      expect(next).toHaveBeenCalled();

      // Verify health check route was added
      expect(getSpy).toHaveBeenCalledWith(
        API.HEALTH_CHECK_PATH,
        expect.any(Function)
      );
      const healthCheckHandler = getSpy.mock.calls[0][1];
      const healthCheckRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      healthCheckHandler(req, healthCheckRes);

      expect(healthCheckRes.status).toHaveBeenCalledWith(200);
      expect(healthCheckRes.json).toHaveBeenCalledWith({
        status: "ok",
        message: "Chapters Slack bot API is running",
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
      });
    });
  });

  describe("configureExpressApp", () => {
    it("should configure security middleware and health check route", () => {
      const getSpy = vi.fn();
      const useSpy = vi.fn();
      const app = {
        get: getSpy,
        use: useSpy,
      } as unknown as ExpressApp;

      configureExpressApp(app);

      // Verify security middleware was added
      expect(useSpy).toHaveBeenCalled();
      const middleware = useSpy.mock.calls[0][0];
      const req = {} as Request;
      const res = {
        setHeader: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      middleware(req, res, next);

      // Verify security headers were set
      expect(res.setHeader).toHaveBeenCalledWith(
        Security.HEADERS.CONTENT_TYPE_OPTIONS,
        Security.HEADER_VALUES.NO_SNIFF
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        Security.HEADERS.FRAME_OPTIONS,
        Security.HEADER_VALUES.DENY_FRAMES
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        Security.HEADERS.XSS_PROTECTION,
        Security.HEADER_VALUES.BLOCK_XSS
      );
      expect(next).toHaveBeenCalled();

      // Verify health check route was added
      expect(getSpy).toHaveBeenCalledWith(
        API.HEALTH_CHECK_PATH,
        expect.any(Function)
      );
      const healthCheckHandler = getSpy.mock.calls[0][1];
      const healthCheckRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      healthCheckHandler(req, healthCheckRes);

      expect(healthCheckRes.status).toHaveBeenCalledWith(200);
      expect(healthCheckRes.json).toHaveBeenCalledWith({
        status: "ok",
        message: "Chapters Slack bot API is running",
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
      });
    });
  });
});
