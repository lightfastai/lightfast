import { join } from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";
import { logger } from "../logger";
import { applySchema } from "./schema";

const DB_FILENAME = "app.db_v1";

let connection: Database.Database | null = null;
let initFailed = false;

function dbPath(): string {
  return join(app.getPath("userData"), DB_FILENAME);
}

export function initDb(): void {
  if (connection || initFailed) {
    return;
  }
  try {
    const db = new Database(dbPath());
    // WAL = concurrent reads alongside writes; survives crashes.
    // synchronous=NORMAL is the WAL-recommended pairing.
    // foreign_keys=ON because SQLite ships them off by default.
    // busy_timeout protects against transient EBUSY in dev when tools peek.
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    applySchema(db);
    connection = db;
    logger.info("[db] opened", { path: dbPath() });
  } catch (err) {
    initFailed = true;
    logger.error("[db] init failed; falling back to in-memory defaults", err);
    // Don't rethrow — boot must continue. Consumers null-check getDb().
  }
}

export function getDb(): Database.Database | null {
  return connection;
}

export function closeDb(): void {
  if (connection) {
    try {
      connection.close();
    } catch (err) {
      logger.warn("[db] close failed", err);
    }
    connection = null;
  }
  // Allow re-init after close (tests, dev hot-reload).
  initFailed = false;
}
