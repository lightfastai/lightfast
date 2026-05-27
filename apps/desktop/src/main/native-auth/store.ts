import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type NativeSession,
  nativeSessionSchema,
} from "@repo/native-auth-contract";
import { app, safeStorage } from "electron";
import { z } from "zod";
import { logger } from "../logger";

export const desktopNativeSessionSchema = nativeSessionSchema.extend({
  client: z.literal("desktop"),
});

export type DesktopNativeSession = z.infer<typeof desktopNativeSessionSchema>;

export interface AuthSnapshot {
  isSignedIn: boolean;
  organizationId?: string;
  organizationName?: string;
  organizationSlug?: string | null;
  userEmail?: string | null;
}

function defaultStorePath(): string {
  return join(app.getPath("userData"), "auth.bin");
}

function purgePersisted(filePath: string): boolean {
  try {
    rmSync(filePath, { force: true });
    return true;
  } catch (err) {
    logger.warn("[native-session-store] purge failed", err);
    return false;
  }
}

export function createNativeSessionStore(filePath = defaultStorePath()) {
  let memory: DesktopNativeSession | null = null;

  return {
    clearMemory(): void {
      memory = null;
    },
    getSession(): DesktopNativeSession | null {
      if (memory) {
        return memory;
      }
      if (!(existsSync(filePath) && safeStorage.isEncryptionAvailable())) {
        return null;
      }
      try {
        const plain = safeStorage.decryptString(readFileSync(filePath));
        const parsed = desktopNativeSessionSchema.safeParse(JSON.parse(plain));
        if (!parsed.success) {
          purgePersisted(filePath);
          return null;
        }
        memory = parsed.data;
        return memory;
      } catch (err) {
        logger.error("[native-session-store] failed to load; purging", err);
        purgePersisted(filePath);
        return null;
      }
    },
    setSession(session: NativeSession): boolean {
      if (!safeStorage.isEncryptionAvailable()) {
        logger.error(
          "[native-session-store] safeStorage unavailable; refusing to write plaintext"
        );
        return false;
      }
      try {
        const parsed = desktopNativeSessionSchema.parse(session);
        writeFileSync(
          filePath,
          safeStorage.encryptString(JSON.stringify(parsed))
        );
        memory = parsed;
        return true;
      } catch (err) {
        logger.error("[native-session-store] failed to persist", err);
        return false;
      }
    },
    signOut(): boolean {
      const ok = purgePersisted(filePath);
      memory = null;
      return ok;
    },
  };
}

const globalStore = createNativeSessionStore();
const listeners = new Set<(snapshot: AuthSnapshot) => void>();

function snapshot(session = globalStore.getSession()): AuthSnapshot {
  return {
    isSignedIn: !!session,
    organizationId: session?.organization.id,
    organizationName: session?.organization.name,
    organizationSlug: session?.organization.slug,
    userEmail: session?.user.email,
  };
}

function emit(): void {
  const current = snapshot();
  for (const listener of listeners) {
    listener(current);
  }
}

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot();
}

export function getSession(): DesktopNativeSession | null {
  return globalStore.getSession();
}

export function getToken(): string | null {
  return getSession()?.tokens.accessToken ?? null;
}

export function setSession(session: NativeSession): boolean {
  const ok = globalStore.setSession(session);
  if (ok) {
    emit();
  }
  return ok;
}

export function signOut(): boolean {
  const wasSignedIn = snapshot().isSignedIn;
  const ok = globalStore.signOut();
  if (ok || wasSignedIn) {
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
