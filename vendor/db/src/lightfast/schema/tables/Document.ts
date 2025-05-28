import { sql } from "drizzle-orm";
import {
  foreignKey,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod";

import { nanoid } from "@repo/lib";

import { Session } from "./Session";

export const DocumentKind = ["code", "3d"] as const;

export const $DocumentKind = z.enum(DocumentKind);

export type DocumentKind = z.infer<typeof $DocumentKind>;

export const pgDocumentKindEnum = pgEnum("document_kind", DocumentKind);

export const Document = pgTable(
  "document",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .$defaultFn(() => nanoid()),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").$onUpdateFn(() => sql`now()`),
    title: text("title").notNull(),
    content: text("content"),
    kind: pgDocumentKindEnum("kind").notNull(),
    sessionId: varchar("sessionId", { length: 191 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.createdAt] }),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [Session.id],
    }).onDelete("cascade"),
  ],
);

export type Document = typeof Document.$inferSelect;
