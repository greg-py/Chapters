import { ObjectId } from "mongodb";
import { connectToDatabase } from "../db";
import { createRating, getRatingsByCycle, getRatingsByUser } from "../dto";
import type { TRating } from "../models";

/**
 * Service class for handling book rating operations
 */
export class Rating {
  /**
   * Submit a rating for the selected book
   * @param ratingData - The rating data
   */
  public static async submitRating(ratingData: {
    userId: string;
    cycleId: ObjectId;
    bookId: ObjectId;
    rating: number;
    recommend: boolean;
  }): Promise<ObjectId> {
    const db = await connectToDatabase();

    const rating: TRating = {
      ...ratingData,
      createdAt: new Date(),
    };

    return await createRating(db, rating);
  }

  /**
   * Check if a user has already rated the book in the cycle
   * @param userId - The ID of the user to check
   * @param cycleId - The ID of the cycle
   * @returns true if the user has already rated, false otherwise
   */
  public static async hasUserRatedInCycle(
    userId: string,
    cycleId: ObjectId
  ): Promise<boolean> {
    const db = await connectToDatabase();
    const userRatings = await getRatingsByUser(db, userId, cycleId);
    return userRatings.length > 0;
  }

  /**
   * Get all ratings for a cycle
   * @param cycleId - The ID of the cycle
   * @returns Array of ratings for the cycle
   */
  public static async getAllForCycle(cycleId: ObjectId): Promise<TRating[]> {
    const db = await connectToDatabase();
    return await getRatingsByCycle(db, cycleId);
  }

  /**
   * Calculate rating statistics for a cycle
   * @param cycleId - The ID of the cycle
   * @returns Object containing average rating and recommendation percentage
   */
  public static async getStatsForCycle(cycleId: ObjectId): Promise<{
    averageRating: number;
    recommendationPercentage: number;
    totalRatings: number;
  }> {
    const ratings = await this.getAllForCycle(cycleId);

    if (ratings.length === 0) {
      return {
        averageRating: 0,
        recommendationPercentage: 0,
        totalRatings: 0,
      };
    }

    const totalRating = ratings.reduce((sum, rating) => sum + rating.rating, 0);
    const averageRating = totalRating / ratings.length;

    const recommendCount = ratings.filter((rating) => rating.recommend).length;
    const recommendationPercentage = (recommendCount / ratings.length) * 100;

    return {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
      recommendationPercentage: Math.round(recommendationPercentage),
      totalRatings: ratings.length,
    };
  }
}
