import { ObjectId } from "mongodb";
import { z } from "zod";

export const SuggestionSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  cycleId: z.instanceof(ObjectId),
  userId: z.string(),
  bookName: z.string(),
  author: z.string(),
  link: z.string(),
  notes: z.string().optional(),
  createdAt: z.date(),
  totalPoints: z.number().int().min(0).default(0),
  voters: z.array(z.string()).default([]),
});

export type TSuggestion = z.infer<typeof SuggestionSchema>;
