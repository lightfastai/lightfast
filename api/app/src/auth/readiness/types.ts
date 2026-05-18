/**
 * Authorization readiness — the answer to "is this principal qualified to
 * proceed?". Orthogonal to identity. The "n/a" variant is what the composite
 * resolver emits when there is no active identity (so readiness is not
 * applicable). Vendor-agnostic — keys are arbitrary strings; specific
 * readiness implementations (Lightfast tasks, billing, etc.) supply the
 * required-keys set to `deriveReadiness`.
 */
export type AuthReadiness =
  | { type: "n/a" }
  | { type: "pending"; current: string; remaining: string[] }
  | { type: "cleared" };

/**
 * Pure derivation from a list of required keys + a set of cleared keys.
 * No IO, no vendor coupling. Specific readiness resolvers supply the inputs.
 */
export function deriveReadiness(
  requiredKeys: readonly string[],
  cleared: ReadonlySet<string>
): AuthReadiness {
  const remaining = requiredKeys.filter((k) => !cleared.has(k));
  if (remaining.length === 0) {
    return { type: "cleared" };
  }
  return { type: "pending", current: remaining[0]!, remaining };
}
