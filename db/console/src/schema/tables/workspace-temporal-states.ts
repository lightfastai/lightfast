import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Entity types that can have temporal state tracking
 */
export type TemporalEntityType = "project" | "feature" | "service" | "sprint" | "issue" | "pr";

/**
 * State types for temporal tracking
 */
export type TemporalStateType = "status" | "progress" | "health" | "risk" | "priority" | "assignee";

/**
 * Bi-temporal state tracking for engineering entities
 * Enables point-in-time queries like "what was the status of Project X last month?"
 *
 * Uses SCD Type 2 pattern with validFrom/validTo for state validity periods.
 */
export const workspaceTemporalStates = pgTable(
  "lightfast_workspace_temporal_states",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    // ========== ENTITY ==========

    /**
     * Type of entity being tracked (project, feature, issue, etc.)
     */
    entityType: varchar("entity_type", { length: 50 })
      .notNull()
      .$type<TemporalEntityType>(),

    /**
     * Entity identifier (e.g., Linear issue ID, GitHub PR number)
     */
    entityId: varchar("entity_id", { length: 191 }).notNull(),

    /**
     * Human-readable entity name for display
     */
    entityName: varchar("entity_name", { length: 255 }),

    // ========== STATE ==========

    /**
     * Type of state being tracked (status, progress, health, etc.)
     */
    stateType: varchar("state_type", { length: 50 })
      .notNull()
      .$type<TemporalStateType>(),

    /**
     * Current state value (e.g., "in_progress", "blocked", "high")
     */
    stateValue: varchar("state_value", { length: 255 }).notNull(),

    /**
     * Previous state value for audit trail
     */
    previousValue: varchar("previous_value", { length: 255 }),

    /**
     * Additional state metadata (percentage complete, blockers, etc.)
     */
    stateMetadata: jsonb("state_metadata").$type<Record<string, unknown>>(),

    // ========== TEMPORAL (Bi-temporal) ==========

    /**
     * When this state became valid (in reality / business time)
     * This is when the state change actually happened
     */
    validFrom: timestamp("valid_from", {
      mode: "string",
      withTimezone: true,
    }).notNull(),

    /**
     * When this state stopped being valid (null = still current)
     * Set when a new state supersedes this one
     */
    validTo: timestamp("valid_to", {
      mode: "string",
      withTimezone: true,
    }),

    /**
     * Fast lookup flag for current state (only one per entity+stateType)
     */
    isCurrent: boolean("is_current").default(true).notNull(),

    // ========== CHANGE METADATA ==========

    /**
     * Actor who made this change (resolved actor ID)
     */
    changedByActorId: varchar("changed_by_actor_id", { length: 191 }),

    /**
     * Reason for the change (optional description)
     */
    changeReason: text("change_reason"),

    /**
     * Observation that triggered this state change
     */
    sourceObservationId: varchar("source_observation_id", { length: 191 }),

    /**
     * External source of the state change (github, linear, etc.)
     */
    source: varchar("source", { length: 50 }),

    // ========== TIMESTAMPS ==========

    /**
     * System time when this record was created
     */
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for point-in-time entity queries: "what was status at time T?"
    entityTimeIdx: index("temporal_entity_time_idx").on(
      table.workspaceId,
      table.entityType,
      table.entityId,
      table.stateType,
      table.validFrom,
    ),

    // Index for current state lookups (fast path)
    currentIdx: index("temporal_current_idx").on(
      table.workspaceId,
      table.entityType,
      table.entityId,
      table.isCurrent,
    ),

    // Index for workspace + entity type queries (dashboard views)
    workspaceEntityIdx: index("temporal_workspace_entity_idx").on(
      table.workspaceId,
      table.entityType,
    ),

    // Index for finding states by source observation
    sourceObsIdx: index("temporal_source_obs_idx").on(
      table.sourceObservationId,
    ),
  }),
);

export type WorkspaceTemporalState = typeof workspaceTemporalStates.$inferSelect;
export type InsertWorkspaceTemporalState = typeof workspaceTemporalStates.$inferInsert;
