import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as Sentry from "@sentry/electron/main";
import { app, safeStorage } from "electron";
import { z } from "zod";

const persistedSchema = z.object({
  token: z.string().min(1),
  savedAt: z.number().int().positive(),
});
type Persisted = z.infer<typeof persistedSchema>;

export interface AuthSnapshot {
  isSignedIn: boolean;
}

let memory: string | null = null;
const listeners = new Set<(snapshot: AuthSnapshot) => void>();

function storePath(): string {
  return join(app.getPath("userData"), "auth.bin");
}

function load(): string | null {
  if (memory) {
    return memory;
  }
  const path = storePath();
  if (!existsSync(path)) {
    return null;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    return null;
  }
  try {
    const buf = readFileSync(path);
    const plain = safeStorage.decryptString(buf);
    const parsed = persistedSchema.safeParse(JSON.parse(plain));
    if (!parsed.success) {
      console.error("[auth-store] invalid persisted payload", parsed.error);
      Sentry.captureException(parsed.error, {
        tags: { scope: "auth-store.load.schema" },
      });
      rmSync(path, { force: true });
      return null;
    }
    memory = parsed.data.token;
    return memory;
  } catch (err) {
    console.error("[auth-store] failed to load; purging", err);
    Sentry.captureException(err, { tags: { scope: "auth-store.load" } });
    rmSync(path, { force: true });
    return null;
  }
}

function persist(token: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    console.error(
      "[auth-store] safeStorage unavailable; refusing to write plaintext"
    );
    return false;
  }
  try {
    const payload: Persisted = { token, savedAt: Date.now() };
    const buf = safeStorage.encryptString(JSON.stringify(payload));
    writeFileSync(storePath(), buf);
    memory = token;
    return true;
  } catch (err) {
    console.error("[auth-store] failed to persist", err);
    Sentry.captureException(err, { tags: { scope: "auth-store.persist" } });
    return false;
  }
}

function clearPersisted(): boolean {
  try {
    rmSync(storePath(), { force: true });
    memory = null;
    return true;
  } catch (err) {
    console.error("[auth-store] failed to remove", err);
    Sentry.captureException(err, { tags: { scope: "auth-store.clear" } });
    return false;
  }
}

function emit(): void {
  const snapshot: AuthSnapshot = { isSignedIn: memory !== null };
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function getAuthSnapshot(): AuthSnapshot {
  if (memory === null) {
    load();
  }
  return { isSignedIn: memory !== null };
}

export function getToken(): string | null {
  if (memory === null) {
    load();
  }
  return memory;
}

export function setToken(token: string): boolean {
  const ok = persist(token);
  if (ok) {
    emit();
  }
  return ok;
}

export function signOut(): boolean {
  const ok = clearPersisted();
  if (ok) {
    emit();
  }
  return ok;
}

export function onAuthChanged(
  listener: (snapshot: AuthSnapshot) => void
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
