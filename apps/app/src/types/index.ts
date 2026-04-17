/**
 * Centralized type definitions for Console app
 *
 * All types extracted from tRPC RouterOutputs - never import from @db/app/schema directly!
 */

import type { RouterOutputs } from "@repo/app-trpc/types";

// ============================================================================
// Jobs
// ============================================================================

export type JobsListResponse = RouterOutputs["jobs"]["list"];
export type Job = JobsListResponse["items"][number];
export type JobStatus = Job["status"];

// ============================================================================
// Entities
// ============================================================================

export type EntitiesListResponse = RouterOutputs["entities"]["list"];
export type Entity = EntitiesListResponse["entities"][number];
export type EntityDetail = RouterOutputs["entities"]["get"];
export type EntityEventsResponse = RouterOutputs["entities"]["getEvents"];
export type EntityEvent = EntityEventsResponse["events"][number];

// ============================================================================
// Events
// ============================================================================

export type EventListItem = RouterOutputs["events"]["list"]["events"][number];

// ============================================================================
// Sources & Connections
// ============================================================================

export type ResourcesList = RouterOutputs["connections"]["resources"]["list"];
export type Source = ResourcesList["list"][number];
