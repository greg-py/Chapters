import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { formatCycleCompletionMessage } from "./cycleCompletion";
import { Cycle, Suggestion, Rating } from "../services";

// Mock the services
vi.mock("../services", () => ({
  Cycle: vi.fn(),
  Suggestion: {
    getById: vi.fn(),
    getAllForCycle: vi.fn(),
  },
  Rating: {
    getStatsForCycle: vi.fn(),
  },
}));

describe("formatCycleCompletionMessage", () => {
  const mockCycleId = new ObjectId();
  const mockBookId = new ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should format a basic completion message without selected book", async () => {
    // Mock cycle with no selected book
    const mockCycle = {
      getName: vi.fn().mockReturnValue("Test Cycle"),
      getSelectedBookId: vi.fn().mockReturnValue(undefined),
      getId: vi.fn().mockReturnValue(mockCycleId),
      getStartDate: vi.fn().mockReturnValue(new Date("2024-01-01")),
      getPhaseTimings: vi.fn().mockReturnValue({}),
      getStats: vi.fn().mockResolvedValue({
        totalSuggestions: 5,
        totalVotes: 3,
      }),
    };

    vi.mocked(Suggestion.getAllForCycle).mockResolvedValue([]);

    const result = await formatCycleCompletionMessage(mockCycle as any);

    expect(result).toContain("Book Club Cycle Completed!");
    expect(result).toContain("Test Cycle");
    expect(result).toContain("5 book suggestions");
    expect(result).toContain("3 members voted");
    expect(result).toContain("Thank you to everyone who participated!");
  });

  it("should format a complete message with selected book, voting results, and ratings", async () => {
    const mockBook = {
      getBookName: vi.fn().mockReturnValue("Test Book"),
      getAuthor: vi.fn().mockReturnValue("Test Author"),
      getLink: vi.fn().mockReturnValue("https://example.com/book"),
      getNotes: vi.fn().mockReturnValue("Great book!"),
    };

    const mockSuggestions = [
      {
        getBookName: vi.fn().mockReturnValue("Test Book"),
        getTotalPoints: vi.fn().mockReturnValue(10),
        getVoters: vi.fn().mockReturnValue(["user1", "user2"]),
      },
      {
        getBookName: vi.fn().mockReturnValue("Another Book"),
        getTotalPoints: vi.fn().mockReturnValue(5),
        getVoters: vi.fn().mockReturnValue(["user3"]),
      },
    ];

    const mockCycle = {
      getName: vi.fn().mockReturnValue("Test Cycle"),
      getSelectedBookId: vi.fn().mockReturnValue(mockBookId),
      getId: vi.fn().mockReturnValue(mockCycleId),
      getStartDate: vi.fn().mockReturnValue(new Date("2024-01-01")),
      getPhaseTimings: vi.fn().mockReturnValue({
        reading: {
          startDate: new Date("2024-01-15"),
          endDate: new Date("2024-02-14"),
        },
        discussion: {
          endDate: new Date("2024-02-21"),
        },
      }),
      getStats: vi.fn().mockResolvedValue({
        totalSuggestions: 2,
        totalVotes: 3,
      }),
    };

    vi.mocked(Suggestion.getById).mockResolvedValue(mockBook as any);
    vi.mocked(Suggestion.getAllForCycle).mockResolvedValue(
      mockSuggestions as any
    );
    vi.mocked(Rating.getStatsForCycle).mockResolvedValue({
      averageRating: 8.5,
      recommendationPercentage: 85,
      totalRatings: 4,
    });

    const result = await formatCycleCompletionMessage(mockCycle as any);

    expect(result).toContain("Book Club Cycle Completed!");
    expect(result).toContain("Test Cycle");
    expect(result).toContain("Selected Book");
    expect(result).toContain("Test Book");
    expect(result).toContain("Test Author");
    expect(result).toContain("https://example.com/book");
    expect(result).toContain("Great book!");
    expect(result).toContain("Voting Summary");
    expect(result).toContain("🥇 *Test Book* (10 pts)");
    expect(result).toContain("🥈 *Another Book* (5 pts)");
    expect(result).toContain("3 members participated in voting");
    expect(result).toContain("Reading Phase");
    expect(result).toContain("Duration: 30 days");
    expect(result).toContain("Book Ratings");
    expect(result).toContain("⭐⭐⭐⭐⭐⭐⭐⭐✨ 8.5/10");
    expect(result).toContain("85% would recommend");
    expect(result).toContain("4 members rated this book");
    expect(result).toContain("Cycle Summary");
    expect(result).toContain("2 book suggestions");
    expect(result).toContain("51 days total cycle duration");
  });
});
