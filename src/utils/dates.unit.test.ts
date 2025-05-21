import { describe, it, expect } from "vitest";
import { formatDate } from "./dates";

describe("Date utilities", () => {
  describe("formatDate", () => {
    it("should format a date correctly", () => {
      const date = new Date(2024, 2, 15);
      const formatted = formatDate(date);
      expect(formatted).toBe("Friday, March 15, 2024");
    });

    it("should handle January 1st", () => {
      const date = new Date(2024, 0, 1);
      const formatted = formatDate(date);
      expect(formatted).toBe("Monday, January 1, 2024");
    });

    it("should handle December 31st", () => {
      const date = new Date(2024, 11, 31);
      const formatted = formatDate(date);
      expect(formatted).toBe("Tuesday, December 31, 2024");
    });

    it("should handle leap year February 29th", () => {
      const date = new Date(2024, 1, 29);
      const formatted = formatDate(date);
      expect(formatted).toBe("Thursday, February 29, 2024");
    });
  });
});
