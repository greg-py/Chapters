import { ObjectId } from "mongodb";
import { z } from "zod";

export const SuggestionSchema = z.object({
  id: z.instanceof(ObjectId),
  cycleId: z.instanceof(ObjectId),
  userId: z.string(),
  bookName: z.string(),
  author: z.string(),
  link: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.date(),
  votes: z.number().int().min(0).default(0),
});

export type TSuggestion = z.infer<typeof SuggestionSchema>;
