import type { SignatureScheme, VerifyFn } from "../../provider/webhook";
import { _deriveEd25519Verify } from "./ed25519";
import { _deriveHmacVerify } from "./hmac";

// Exhaustive switch — TypeScript errors if a new `kind` is added to
// signatureSchemeSchema without a corresponding case here.
export function deriveVerifySignature(scheme: SignatureScheme): VerifyFn {
  switch (scheme.kind) {
    case "hmac":
      return _deriveHmacVerify(scheme);
    case "ed25519":
      return _deriveEd25519Verify(scheme);

    default: {
      const _exhaustive: never = scheme;
      return _exhaustive;
    }
  }
}
