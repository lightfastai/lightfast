import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  json,
  mysqlTable,
  varchar,
  index,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib";

export const LightfastChatAttachment = mysqlTable(
  "lightfast_chat_attachment",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    userId: varchar("user_id", { length: 191 }).notNull(),
    storagePath: varchar("storage_path", { length: 512 }).notNull(),
    filename: varchar("filename", { length: 256 }),
    contentType: varchar("content_type", { length: 128 }),
    size: bigint("size", { mode: "number" }).notNull(),
    metadata: json("metadata"),
    createdAt: datetime("created_at", { mode: "string" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime("updated_at", { mode: "string" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdIdx: index("user_id_idx").on(table.userId),
  }),
);

export type LightfastChatAttachment =
  typeof LightfastChatAttachment.$inferSelect;
export type InsertLightfastChatAttachment =
  typeof LightfastChatAttachment.$inferInsert;

export const insertLightfastChatAttachmentSchema = createInsertSchema(
  LightfastChatAttachment,
);
export const selectLightfastChatAttachmentSchema = createSelectSchema(
  LightfastChatAttachment,
);
