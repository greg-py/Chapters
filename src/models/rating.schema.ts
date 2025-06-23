import { ObjectId } from "mongodb";
import { z } from "zod";

export const RatingSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  cycleId: z.instanceof(ObjectId),
  userId: z.string(),
  bookId: z.instanceof(ObjectId),
  rating: z.number().int().min(1).max(10),
  recommend: z.boolean(),
  createdAt: z.date(),
});

export type TRating = z.infer<typeof RatingSchema>;
