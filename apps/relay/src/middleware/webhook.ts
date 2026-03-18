import type { ProviderName, WebhookProvider } from "@repo/console-providers";
import {
  computeHmac,
  deriveVerifySignature,
  getProvider,
  isWebhookProvider,
  timingSafeStringEqual,
} from "@repo/console-providers";
import type { ServiceAuthWebhookBody } from "@repo/console-providers/contracts";
import { serviceAuthWebhookBodySchema } from "@repo/console-providers/contracts";
import { log } from "@vendor/observability/log/edge";
import { createMiddleware } from "hono/factory";
import { env } from "../env.js";
import type { LifecycleVariables } from "./lifecycle.js";

// ── Context Variables ────────────────────────────────────────────────────────

/**
 * Variables set progressively by the webhook middleware chain.
 *
 * After `payloadParseAndExtract` completes, ALL fields are guaranteed populated.
 * Hono's context typing doesn't express middleware ordering, so fields set by
 * later middleware are typed as potentially undefined. The `WebhookContext`
 * helper below provides the narrowed "post-middleware" view for the handler.
 */
export interface WebhookVariables extends LifecycleVariables {
  /** Set by payloadParseAndExtract. */
  deliveryId: string;
  /** Set by payloadParseAndExtract. */
  eventType: string;
  /** True when request authenticated via X-API-Key (internal service). */
  isServiceAuth: boolean;
  /** Parsed + schema-validated webhook payload (both paths). Set by payloadParseAndExtract. */
  parsedPayload: unknown;
  providerDef: WebhookProvider;
  providerName: ProviderName;
  /** Present only on standard webhook path — raw body string for HMAC. */
  rawBody: string | undefined;
  /** Set by payloadParseAndExtract. */
  resourceId: string | null;
  /** Present only on service auth path — validated body. */
  serviceAuthBody: ServiceAuthWebhookBody | undefined;
}

/**
 * Narrowed context type for the final handler — after all middleware has run.
 * Use with `c as unknown as WebhookContext` if needed, or just `c.get()` directly
 * since the variables are now non-optional.
 */
export interface WebhookContext {
  get(key: "providerDef"): WebhookProvider;
  get(key: "providerName"): ProviderName;
  get(key: "isServiceAuth"): boolean;
  get(key: "serviceAuthBody"): ServiceAuthWebhookBody | undefined;
  get(key: "rawBody"): string | undefined;
  get(key: "parsedPayload"): unknown;
  get(key: "eventType" | "deliveryId"): string;
  get(key: "resourceId"): string | null;
}

// ── 1. Provider Guard ────────────────────────────────────────────────────────
// Validates :provider param, attaches providerDef + providerName to context.

export const providerGuard = createMiddleware<{
  Variables: WebhookVariables;
}>(async (c, next) => {
  const rawProvider = c.req.param("provider") ?? "";
  const providerDef = getProvider(rawProvider);

  if (!providerDef) {
    return c.json({ error: "unknown_provider", provider: rawProvider }, 400);
  }

  // API-only providers (kind: "api") never send inbound webhooks — reject early.
  if (!isWebhookProvider(providerDef)) {
    return c.json({ error: "unknown_provider", provider: rawProvider }, 400);
  }

  // Cast needed: getProvider returns a union of concrete WebhookProvider<GitHubConfig|...>
  // but WebhookVariables stores WebhookProvider (TConfig=unknown). The middleware only
  // uses config-independent methods (verifySignature, parsePayload, etc.) so this is safe.
  c.set("providerDef", providerDef as WebhookProvider);
  c.set("providerName", providerDef.name as ProviderName);
  return await next();
});

// ── 2. Service Auth Detection ────────────────────────────────────────────────
// Checks X-API-Key. If valid → service auth path. If absent → standard path.

export const serviceAuthDetect = createMiddleware<{
  Variables: WebhookVariables;
}>(async (c, next) => {
  const apiKey = c.req.header("X-API-Key");

  if (apiKey && timingSafeStringEqual(apiKey, env.GATEWAY_API_KEY)) {
    c.set("isServiceAuth", true);
  } else {
    c.set("isServiceAuth", false);
  }

  await next();
});

// ── 3. Service Auth Body Validator ───────────────────────────────────────────
// Validates JSON body against serviceAuthWebhookBodySchema.
// Only runs on service auth path — skips if isServiceAuth is false.

export const serviceAuthBodyValidator = createMiddleware<{
  Variables: WebhookVariables;
}>(async (c, next) => {
  if (!c.get("isServiceAuth")) {
    return await next();
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const result = serviceAuthWebhookBodySchema.safeParse(raw);
  if (!result.success) {
    return c.json(
      { error: "invalid_body", details: result.error.flatten() },
      400
    );
  }

  c.set("serviceAuthBody", result.data);
  return await next();
});

// ── 4. Webhook Header Guard ─────────────────────────────────────────────────
// Validates required provider headers exist BEFORE reading the body.
// Only runs on standard webhook path — skips if isServiceAuth is true.

export const webhookHeaderGuard = createMiddleware<{
  Variables: WebhookVariables;
}>(async (c, next) => {
  if (c.get("isServiceAuth")) {
    return await next();
  }

  const providerDef = c.get("providerDef");
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const result = providerDef.webhook.headersSchema.safeParse(headers);
  if (!result.success) {
    log.warn("[webhook] missing required headers", {
      provider: c.get("providerName"),
      missing_fields: result.error.issues.map((i) => i.path.join(".")),
    });
    return c.json({ error: "missing_required_headers" }, 400);
  }

  return await next();
});

// ── 5. Raw Body Capture ─────────────────────────────────────────────────────
// Reads raw body string and stores in context for HMAC verification.
// Only runs on standard webhook path.

export const rawBodyCapture = createMiddleware<{
  Variables: WebhookVariables;
}>(async (c, next) => {
  if (c.get("isServiceAuth")) {
    return await next();
  }

  const rawBody = await c.req.text();
  c.set("rawBody", rawBody);

  log.info("[webhook] raw body captured", {
    provider: c.get("providerName"),
    body_length: rawBody.length,
    content_type: c.req.header("content-type"),
    content_encoding: c.req.header("content-encoding"),
    transfer_encoding: c.req.header("transfer-encoding"),
  });

  return await next();
});

// ── 6. Signature Verification ───────────────────────────────────────────────
// HMAC verification using provider-specific verifySignature.
// Only runs on standard webhook path.

export const signatureVerify = createMiddleware<{
  Variables: WebhookVariables;
}>(async (c, next) => {
  if (c.get("isServiceAuth")) {
    return await next();
  }

  const providerDef = c.get("providerDef");
  const providerName = c.get("providerName");
  const rawBody = c.get("rawBody");
  if (!rawBody) {
    return c.json({ error: "missing_body" }, 400);
  }

  // Resolve provider config on demand — no manual secret map needed.
  // createConfig returns null for optional providers when their env vars are absent.
  const providerConfig = providerDef.createConfig(
    env as unknown as Record<string, string>,
    { callbackBaseUrl: "" }
  );
  if (providerConfig == null) {
    log.warn("[webhook] provider not configured (missing env vars)", {
      provider: providerName,
    });
    return c.json({ error: "provider_not_configured" }, 500);
  }
  const secret = providerDef.webhook.extractSecret(providerConfig);

  const verify =
    providerDef.webhook.verifySignature ??
    deriveVerifySignature(providerDef.webhook.signatureScheme);
  const valid = await Promise.resolve(
    verify(rawBody, c.req.raw.headers, secret)
  );
  if (!valid) {
    const scheme = providerDef.webhook.signatureScheme;
    const sigReceived = c.req.header(scheme.signatureHeader) ?? "";
    const sigExpected =
      scheme.kind === "hmac"
        ? `${scheme.prefix ?? ""}${computeHmac(rawBody, secret, scheme.algorithm === "sha256" ? "SHA-256" : "SHA-1")}`
        : "(non-hmac scheme)";
    log.warn("[webhook] signature mismatch", {
      provider: providerName,
      body_length: rawBody.length,
      secret_length: secret.length,
      sig_received: sigReceived,
      sig_expected: sigExpected,
      sig_match: sigReceived === sigExpected,
    });
    return c.json({ error: "invalid_signature" }, 401);
  }

  return await next();
});

// ── 7. Payload Parse + Extract ──────────────────────────────────────────────
// Parses payload through provider Zod schema, extracts deliveryId/eventType/resourceId.
// Works for both service auth and standard paths.

export const payloadParseAndExtract = createMiddleware<{
  Variables: WebhookVariables;
}>(async (c, next) => {
  const providerDef = c.get("providerDef");
  const isServiceAuth = c.get("isServiceAuth");

  let parsedPayload: unknown;
  let deliveryId: string;
  let eventType: string;
  let resourceId: string | null;

  if (isServiceAuth) {
    const body = c.get("serviceAuthBody");
    if (!body) {
      return c.json({ error: "missing_body" }, 400);
    }

    try {
      parsedPayload = providerDef.webhook.parsePayload(body.payload);
    } catch {
      return c.json({ error: "invalid_payload" }, 400);
    }

    deliveryId = body.deliveryId;
    eventType = body.eventType;
    resourceId = body.resourceId ?? null;
  } else {
    const rawBody = c.get("rawBody");
    if (!rawBody) {
      return c.json({ error: "missing_body" }, 400);
    }

    try {
      parsedPayload = providerDef.webhook.parsePayload(JSON.parse(rawBody));
    } catch {
      return c.json({ error: "invalid_payload" }, 400);
    }

    try {
      const headers = c.req.raw.headers;
      deliveryId = providerDef.webhook.extractDeliveryId(
        headers,
        parsedPayload
      );
      eventType = providerDef.webhook.extractEventType(headers, parsedPayload);
      resourceId = providerDef.webhook.extractResourceId(parsedPayload);
    } catch {
      return c.json(
        { error: "extraction_failed", provider: c.get("providerName") },
        400
      );
    }
  }

  c.set("parsedPayload", parsedPayload);
  c.set("deliveryId", deliveryId);
  c.set("eventType", eventType);
  c.set("resourceId", resourceId);

  return await next();
});
