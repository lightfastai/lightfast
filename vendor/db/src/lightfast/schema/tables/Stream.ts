import type { InferSelectModel } from "drizzle-orm";
import {
  foreignKey,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { nanoid } from "@repo/lib";

import { Session } from "./Session";

export const Stream = pgTable(
  "Stream",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    sessionId: varchar("sessionId", { length: 191 })
      .notNull()
      .references(() => Session.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [Session.id],
    }),
  ],
);

export type Stream = InferSelectModel<typeof Stream>;
