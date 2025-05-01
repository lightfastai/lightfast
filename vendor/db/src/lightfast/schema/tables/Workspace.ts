import { relations, sql } from "drizzle-orm";
import { pgTable } from "drizzle-orm/pg-core";
import { z } from "zod";

import { nanoid } from "@repo/lib";
import { generatePrettyProjectName } from "@repo/lib/pretty-project-name";

import { Session } from "./Session";

export const Workspace = pgTable("workspace", (t) => ({
  id: t
    .varchar({ length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: t
    .varchar({ length: 64 })
    .notNull()
    .$defaultFn(() => generatePrettyProjectName()),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp()
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => sql`now()`),
}));

export const WorkspaceRelations = relations(Workspace, ({ many }) => ({
  sessions: many(Session),
}));

export const UpdateNameWorkspaceSchema = z.object({
  workspaceName: z
    .string()
    .min(4, { message: "Name must be at least 4 characters long." })
    .max(64, { message: "Name must be at most 64 characters long." }),
  id: z.string().min(1),
});

export type UpdateNameWorkspace = z.infer<typeof UpdateNameWorkspaceSchema>;
