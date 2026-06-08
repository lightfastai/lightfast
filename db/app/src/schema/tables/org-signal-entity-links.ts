import type {
  SignalEntityExtractionMethod,
  SignalEntityMentionKind,
  SignalEntityTargetType,
} from "@repo/ai/signal-entity-linker";
import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const CLERK_ID_LENGTH = 64;
const CODE_LENGTH = 32;
const LOCAL_ENTITY_KEY_LENGTH = 64;
const PERSON_ID_LENGTH = 64;
const SIGNAL_ID_LENGTH = 64;

export const SIGNAL_ENTITY_LINK_LABEL_LENGTH = 160;
export const SIGNAL_ENTITY_LINK_ANCHOR_TEXT_LENGTH = 240;
export const SIGNAL_ENTITY_LINK_NORMALIZED_MENTION_VALUE_LENGTH = 512;

export const orgSignalEntityLinks = mysqlTable(
  "lightfast_org_signal_entity_links",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    signalId: varchar("signal_id", { length: SIGNAL_ID_LENGTH }).notNull(),

    targetType: varchar("target_type", { length: CODE_LENGTH })
      .$type<SignalEntityTargetType>()
      .notNull(),

    localEntityKey: varchar("local_entity_key", {
      length: LOCAL_ENTITY_KEY_LENGTH,
    }).notNull(),

    label: varchar("label", {
      length: SIGNAL_ENTITY_LINK_LABEL_LENGTH,
    }).notNull(),

    mentionKind: varchar("mention_kind", { length: CODE_LENGTH })
      .$type<SignalEntityMentionKind>()
      .notNull(),

    anchorText: varchar("anchor_text", {
      length: SIGNAL_ENTITY_LINK_ANCHOR_TEXT_LENGTH,
    }).notNull(),

    anchorOccurrence: int("anchor_occurrence", { unsigned: true }).notNull(),

    extractionMethod: varchar("extraction_method", { length: CODE_LENGTH })
      .$type<SignalEntityExtractionMethod>()
      .notNull(),

    confidenceBasisPoints: int("confidence_basis_points", {
      unsigned: true,
    }).notNull(),

    rationale: text("rationale").notNull(),

    normalizedMentionValue: varchar("normalized_mention_value", {
      length: SIGNAL_ENTITY_LINK_NORMALIZED_MENTION_VALUE_LENGTH,
    }).notNull(),

    resolvedPersonId: varchar("resolved_person_id", {
      length: PERSON_ID_LENGTH,
    }),

    resolvedAt: datetime("resolved_at", { mode: "date", fsp: 3 }),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    orgSignalLocalEntityUq: uniqueIndex(
      "org_signal_entity_links_org_signal_local_entity_uq"
    ).on(table.clerkOrgId, table.signalId, table.localEntityKey),
    orgSignalIdx: index("org_signal_entity_links_org_signal_idx").on(
      table.clerkOrgId,
      table.signalId,
      table.id
    ),
    orgResolvedPersonIdx: index(
      "org_signal_entity_links_org_resolved_person_idx"
    ).on(table.clerkOrgId, table.resolvedPersonId, table.id),
    orgMentionLookupIdx: index(
      "org_signal_entity_links_org_mention_lookup_idx"
    ).on(
      table.clerkOrgId,
      table.targetType,
      table.mentionKind,
      table.normalizedMentionValue
    ),
  })
);

export type SignalEntityLink = typeof orgSignalEntityLinks.$inferSelect;
export type InsertSignalEntityLink = typeof orgSignalEntityLinks.$inferInsert;
