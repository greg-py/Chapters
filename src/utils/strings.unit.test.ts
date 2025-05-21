import { describe, it, expect } from "vitest";
import { capitalizeFirstLetter } from "./strings";

describe("String utilities", () => {
  describe("capitalizeFirstLetter", () => {
    it("should capitalize the first letter of a string", () => {
      expect(capitalizeFirstLetter("hello")).toBe("Hello");
      expect(capitalizeFirstLetter("world")).toBe("World");
    });

    it("should handle single character strings", () => {
      expect(capitalizeFirstLetter("a")).toBe("A");
      expect(capitalizeFirstLetter("z")).toBe("Z");
    });

    it("should handle already capitalized strings", () => {
      expect(capitalizeFirstLetter("Hello")).toBe("Hello");
      expect(capitalizeFirstLetter("WORLD")).toBe("WORLD");
    });

    it("should handle empty strings", () => {
      expect(capitalizeFirstLetter("")).toBe("");
    });

    it("should handle strings with special characters", () => {
      expect(capitalizeFirstLetter("123hello")).toBe("123hello");
      expect(capitalizeFirstLetter("!hello")).toBe("!hello");
    });
  });
});
