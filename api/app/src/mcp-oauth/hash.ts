import { createHash } from "node:crypto";

export function hashOpaqueToken(secret: string): string {
  return createHash("sha256").update(secret).digest("base64url");
}
