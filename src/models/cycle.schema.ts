import { z } from "zod";
import { ObjectId } from "mongodb";
export const CycleStatusSchema = z.enum(["active", "completed", "cancelled"]);
export const CyclePhaseSchema = z.enum([
  "pending",
  "suggestion",
  "voting",
  "reading",
  "discussion",
]);

export const PhaseDurationsSchema = z.object({
  suggestion: z.number().int().positive(),
  voting: z.number().int().positive(),
  reading: z.number().int().positive(),
  discussion: z.number().int().positive(),
});

export const CycleStatsSchema = z.object({
  totalSuggestions: z.number().int().min(0),
  totalVotes: z.number().int().min(0),
  participantCount: z.number().int().min(0),
});

export const CycleSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  channelId: z.string(),
  name: z.string(),
  currentPhase: CyclePhaseSchema,
  startDate: z.date(),
  status: CycleStatusSchema,
  stats: CycleStatsSchema,
  phaseDurations: PhaseDurationsSchema,
  selectedBookId: z.instanceof(ObjectId).optional(),
});

export type TCycleStatus = z.infer<typeof CycleStatusSchema>;
export type TPhaseDurations = z.infer<typeof PhaseDurationsSchema>;
export type TCycleStats = z.infer<typeof CycleStatsSchema>;
export type TCycle = z.infer<typeof CycleSchema>;
export type TCyclePhase = z.infer<typeof CyclePhaseSchema>;
