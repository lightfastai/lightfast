import * as ed from "@noble/ed25519";
import type { Ed25519Scheme, VerifyFn } from "../../provider/webhook";

function _base64ToUint8Array(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function _deriveEd25519Verify(scheme: Ed25519Scheme): VerifyFn {
  return async (rawBody, headers, secret) => {
    const rawSig = headers.get(scheme.signatureHeader);
    if (!rawSig) {
      return false;
    }
    // Svix sends space-separated base64 signatures; any must match
    const signatures = scheme.multiSignature ? rawSig.split(" ") : [rawSig];
    const secretBytes = _base64ToUint8Array(secret);
    const messageBytes = scheme.timestampHeader
      ? new TextEncoder().encode(
          `${headers.get(scheme.timestampHeader)}.${rawBody}`
        )
      : new TextEncoder().encode(rawBody);
    for (const sig of signatures) {
      const sigBytes = _base64ToUint8Array(sig);
      if (await ed.verifyAsync(sigBytes, messageBytes, secretBytes)) {
        return true;
      }
    }
    return false;
  };
}
