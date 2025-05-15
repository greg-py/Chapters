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

export const PhaseTimingsSchema = z.object({
  suggestion: z.object({
    startDate: z.date().optional(),
    endDate: z.date().optional(),
  }),
  voting: z.object({
    startDate: z.date().optional(),
    endDate: z.date().optional(),
  }),
  reading: z.object({
    startDate: z.date().optional(),
    endDate: z.date().optional(),
  }),
  discussion: z.object({
    startDate: z.date().optional(),
    endDate: z.date().optional(),
  }),
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
  phaseTimings: PhaseTimingsSchema.optional(),
  selectedBookId: z.instanceof(ObjectId).optional(),
});

export type TCycleStatus = z.infer<typeof CycleStatusSchema>;
export type TPhaseDurations = z.infer<typeof PhaseDurationsSchema>;
export type TCycleStats = z.infer<typeof CycleStatsSchema>;
export type TPhaseTimings = z.infer<typeof PhaseTimingsSchema>;
export type TCycle = z.infer<typeof CycleSchema>;
export type TCyclePhase = z.infer<typeof CyclePhaseSchema>;
