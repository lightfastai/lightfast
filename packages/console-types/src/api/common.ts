/**
 * Common API types shared across endpoints
 */

import { z } from "zod";

/**
 * Common request ID for tracing
 */
export const RequestIdSchema = z.string().uuid();

/**
 * Latency breakdown for API responses
 */
export const LatencySchema = z.object({
  total: z.number().nonnegative(),
  retrieval: z.number().nonnegative(),
  rerank: z.number().nonnegative().optional(),
});

export type Latency = z.infer<typeof LatencySchema>;

/**
 * Common pagination parameters
 */
export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
  cursor: z.string().optional(),
});

export type Pagination = z.infer<typeof PaginationSchema>;
