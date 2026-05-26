import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";

import {
  type NativeSession,
  nativeSessionSchema,
} from "@repo/native-auth-contract";

import { getAuthFilePath } from "./config";

export class SessionStore {
  constructor(private readonly filePath = getAuthFilePath()) {}

  async get(): Promise<NativeSession | null> {
    let contents: string;
    try {
      contents = await readFile(this.filePath, "utf8");
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }
      throw error;
    }

    return nativeSessionSchema.parse(JSON.parse(contents));
  }

  async set(session: NativeSession): Promise<void> {
    const parsed = nativeSessionSchema.parse(session);
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(parsed, null, 2)}\n`, {
      mode: 0o600,
    });
    try {
      await chmod(tempPath, 0o600);
    } catch {
      // Best-effort on platforms/filesystems that do not support POSIX modes.
    }
    await rename(tempPath, this.filePath);
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }
}
