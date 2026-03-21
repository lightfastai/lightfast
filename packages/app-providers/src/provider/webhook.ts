import { z } from "zod";

// ── Signature Schemes (ZOD-FIRST — pure data, no functions) ─────────────────
// Unexported variant schemas — consumers depend on SignatureScheme (the union).
// Extension protocol:
//   Adding sha512: add to algorithm enum + update HMAC_ALGO_MAP.
//   Adding base64: add encoding field with .default("hex") + update _deriveHmacVerify.
//   Adding new kind: new variantSchema + add to union array + new case in deriveVerifySignature.
// In all cases: WebhookDef, ProviderDefinition, and relay middleware are untouched.

const hmacSchemeSchema = z.object({
  kind: z.literal("hmac"),
  algorithm: z.enum(["sha256", "sha1"]),
  signatureHeader: z.string(),
  prefix: z.string().optional(),
});

const ed25519SchemeSchema = z.object({
  kind: z.literal("ed25519"),
  signatureHeader: z.string(),
  timestampHeader: z.string().optional(),
  /** Svix-style: multiple space-separated base64 signatures, any must match */
  multiSignature: z.boolean().optional(),
});

// PUBLIC interface — WebhookDef uses SignatureScheme, never the variant schemas.
// New variants extend this array only.
export const signatureSchemeSchema = z.discriminatedUnion("kind", [
  hmacSchemeSchema,
  ed25519SchemeSchema,
]);

export type HmacScheme = z.infer<typeof hmacSchemeSchema>;
export type Ed25519Scheme = z.infer<typeof ed25519SchemeSchema>;
export type SignatureScheme = z.infer<typeof signatureSchemeSchema>;

// Literal-type-preserving factories: PROVIDERS.*.webhook.signatureScheme.*
// narrows to literal values — enables precise type-level tests without ceremony.
export const hmac = <const T extends Omit<HmacScheme, "kind">>(
  opts: T
): { readonly kind: "hmac" } & T => ({ kind: "hmac", ...opts });

export const ed25519 = <const T extends Omit<Ed25519Scheme, "kind">>(
  opts: T
): { readonly kind: "ed25519" } & T => ({ kind: "ed25519", ...opts });

// VerifyFn is async-capable — Ed25519 verification is async (WebCrypto).
// HMAC returns synchronously; relay awaits all results uniformly.
export type VerifyFn = (
  rawBody: string,
  headers: Headers,
  secret: string
) => boolean | Promise<boolean>;

/** Webhook extraction functions — pure, no env/DB/framework */
export interface WebhookDef<TConfig> {
  extractDeliveryId: (headers: Headers, payload: unknown) => string;
  extractEventType: (headers: Headers, payload: unknown) => string;
  extractResourceId: (payload: unknown) => string | null;
  extractSecret: (config: TConfig) => string;
  /** Zod schema for required webhook headers — validated before body read.
   *  Keys are lowercase header names. Used by relay middleware for early rejection.
   *  Must be a z.object() with string-valued fields (required or optional). */
  readonly headersSchema: z.ZodObject<
    Record<string, z.ZodType<string | undefined>>
  >;
  parsePayload: (raw: unknown) => unknown;
  /** Zod-first signature scheme — relay derives verifySignature from this automatically. */
  readonly signatureScheme: SignatureScheme;
  /** Optional override — only needed when scheme is non-standard.
   *  When absent, relay derives from signatureScheme via deriveVerifySignature(). */
  readonly verifySignature?: (
    rawBody: string,
    headers: Headers,
    secret: string
  ) => boolean;
}

/**
 * Inbound webhook reception for API providers.
 * For providers that use API-key auth but also receive webhooks configured
 * manually by the customer (e.g. Clerk via Svix, Datadog alerts).
 * No programmatic registration — that's ManagedProvider's job.
 */
export interface InboundWebhookDef<TConfig> {
  readonly webhook: WebhookDef<TConfig>;
}

// ── Managed Webhook Types ────────────────────────────────────────────────────

export const webhookSetupStateSchema = z.object({
  endpointId: z.string(),
  signingSecret: z.string(),
});
export type WebhookSetupState = z.infer<typeof webhookSetupStateSchema>;

/**
 * Programmatic webhook lifecycle management for managed providers (HubSpot, Stripe).
 * `register` creates the webhook endpoint on the provider; `unregister` removes it.
 * Returns `TState` (at minimum `endpointId` + `signingSecret`) to store in the DB.
 */
export interface WebhookSetupDef<
  TConfig,
  TState extends WebhookSetupState = WebhookSetupState,
> {
  readonly defaultEvents: readonly string[];
  readonly register: (
    config: TConfig,
    token: string,
    webhookUrl: string,
    events: readonly string[]
  ) => Promise<TState>;
  readonly unregister: (
    config: TConfig,
    token: string,
    state: TState
  ) => Promise<void>;
}

/**
 * Combined inbound webhook definition for managed providers.
 * `webhook` handles verification and extraction; `setup` handles registration.
 */
export interface ManagedWebhookDef<
  TConfig,
  TState extends WebhookSetupState = WebhookSetupState,
> {
  readonly setup: WebhookSetupDef<TConfig, TState>;
  readonly webhook: WebhookDef<TConfig>;
}
