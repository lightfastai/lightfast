import type { HmacScheme, VerifyFn } from "../../provider/webhook";
import { computeHmac, timingSafeEqual } from "../crypto";

// Exhaustive algorithm map. `satisfies Record<HmacScheme["algorithm"], ...>` causes
// a TypeScript error when a new algorithm is added to the enum but not yet added
// here — no silent fallthrough to a wrong algorithm.
const HMAC_ALGO_MAP = {
  sha256: "SHA-256",
  sha1: "SHA-1",
} as const satisfies Record<HmacScheme["algorithm"], "SHA-256" | "SHA-1">;

export function _deriveHmacVerify(scheme: HmacScheme): VerifyFn {
  return (rawBody, headers, secret) => {
    const rawSig = headers.get(scheme.signatureHeader);
    if (!rawSig) {
      return false;
    }
    const received = scheme.prefix
      ? rawSig.slice(scheme.prefix.length)
      : rawSig;
    const expected = computeHmac(
      rawBody,
      secret,
      HMAC_ALGO_MAP[scheme.algorithm]
    );
    return timingSafeEqual(received, expected);
  };
}
