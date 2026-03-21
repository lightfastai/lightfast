import { z } from "zod";

export const backfillDepthSchema = z.union([
  z.literal(1),
  z.literal(7),
  z.literal(30),
  z.literal(90),
]);

export type BackfillDepth = z.infer<typeof backfillDepthSchema>;

/** Ordered options for UI depth selectors. */
export const BACKFILL_DEPTH_OPTIONS = [
  1, 7, 30, 90,
] as const satisfies readonly BackfillDepth[];
