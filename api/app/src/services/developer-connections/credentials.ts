import { decrypt, encrypt } from "@repo/app-encryption";
import { env } from "../../env";

export async function encryptDeveloperCredential(payload: unknown) {
  return await encrypt(JSON.stringify(payload), env.ENCRYPTION_KEY);
}

export async function decryptDeveloperCredential<T>(
  ciphertext: string
): Promise<T> {
  return JSON.parse(await decrypt(ciphertext, env.ENCRYPTION_KEY)) as T;
}

export function redactDeveloperCredential(value: string) {
  if (value.length <= 8) {
    return "[redacted]";
  }
  return `${value.slice(0, 4)}...[redacted]...${value.slice(-4)}`;
}
