import { bigint, varchar } from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";

/**
 * Internal BIGINT primary key with auto-increment.
 * Use for all high-volume tables.
 */
export const internalId = () =>
  bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity();

/**
 * External NanoID for API exposure.
 * Use alongside internalId for tables that need public identifiers.
 */
export const externalId = () =>
  varchar("external_id", { length: 21 })
    .notNull()
    .unique()
    .$defaultFn(() => nanoid());

/**
 * Legacy NanoID primary key.
 * Use only for low-volume root tables (workspaces, API keys).
 */
export const legacyId = () =>
  varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid());
