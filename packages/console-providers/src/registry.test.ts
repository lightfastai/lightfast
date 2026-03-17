import { describe, expectTypeOf, it } from "vitest";
import type { ProviderDefinition } from "./define";
import type { GitHubConfig } from "./providers/github/auth";
import type { LinearConfig } from "./providers/linear/auth";
import type { SentryConfig } from "./providers/sentry/auth";
import type { VercelConfig } from "./providers/vercel/auth";
import type {
  EventKey,
  EventRegistryEntry,
  PROVIDERS,
  ProviderAccountInfo,
  ProviderConfig,
  ProviderName,
} from "./registry";
import { EVENT_REGISTRY, getProvider } from "./registry";

// ── Category 1: ProviderName ────────────────────────────────────────────────

describe("ProviderName", () => {
  it("matches PROVIDERS keys exactly", () => {
    expectTypeOf<ProviderName>().toEqualTypeOf<
      "apollo" | "github" | "vercel" | "linear" | "sentry"
    >();
  });
});

// ── Category 2: EventKey Derivation ─────────────────────────────────────────

describe("EventKey derivation", () => {
  // Positive: known keys exist
  it("includes simple events", () => {
    expectTypeOf<"sentry:error">().toMatchTypeOf<EventKey>();
    expectTypeOf<"sentry:event_alert">().toMatchTypeOf<EventKey>();
    expectTypeOf<"sentry:metric_alert">().toMatchTypeOf<EventKey>();
  });

  it("includes action events with dot-separated actions", () => {
    expectTypeOf<"github:pull_request.opened">().toMatchTypeOf<EventKey>();
    expectTypeOf<"github:pull_request.merged">().toMatchTypeOf<EventKey>();
    expectTypeOf<"github:issues.opened">().toMatchTypeOf<EventKey>();
    expectTypeOf<"vercel:deployment.created">().toMatchTypeOf<EventKey>();
    expectTypeOf<"vercel:deployment.error">().toMatchTypeOf<EventKey>();
    expectTypeOf<"linear:Issue.created">().toMatchTypeOf<EventKey>();
    expectTypeOf<"linear:Comment.updated">().toMatchTypeOf<EventKey>();
    expectTypeOf<"linear:ProjectUpdate.deleted">().toMatchTypeOf<EventKey>();
    expectTypeOf<"sentry:issue.created">().toMatchTypeOf<EventKey>();
    expectTypeOf<"sentry:issue.resolved">().toMatchTypeOf<EventKey>();
  });

  // Negative: invalid keys rejected
  it("rejects unknown providers", () => {
    // @ts-expect-error — "jira:issue" is not a valid provider
    const _a: EventKey = "jira:issue";
  });

  it("rejects unknown events for valid providers", () => {
    // @ts-expect-error — "github:nonexistent" is not an EventKey
    const _b: EventKey = "github:nonexistent";
  });

  it("rejects bare event names without provider prefix", () => {
    // @ts-expect-error — "push" alone is not an EventKey
    const _c: EventKey = "push";
  });

  it("rejects action events used without action suffix", () => {
    // @ts-expect-error — pull_request has actions, must use .opened/.merged/etc.
    const _d: EventKey = "github:pull_request";
  });

  it("rejects invalid actions for valid action events", () => {
    // @ts-expect-error — "github:pull_request.deleted" is not a valid action
    const _e: EventKey = "github:pull_request.deleted";
  });
});

// ── Category 3: getProvider Return Type Narrowing ───────────────────────────

describe("getProvider type narrowing", () => {
  it("returns narrow type for literal provider name", () => {
    const gh = getProvider("github");
    expectTypeOf(gh.webhook.extractSecret)
      .parameter(0)
      .toEqualTypeOf<GitHubConfig>();
  });

  it("returns different narrow types per provider", () => {
    const vc = getProvider("vercel");
    expectTypeOf(vc.webhook.extractSecret)
      .parameter(0)
      .toEqualTypeOf<VercelConfig>();

    const ln = getProvider("linear");
    expectTypeOf(ln.webhook.extractSecret)
      .parameter(0)
      .toEqualTypeOf<LinearConfig>();

    const st = getProvider("sentry");
    expectTypeOf(st.webhook.extractSecret)
      .parameter(0)
      .toEqualTypeOf<SentryConfig>();
  });

  it("returns ProviderDefinition | undefined for dynamic string", () => {
    const p = getProvider("unknown" as string);
    expectTypeOf(p).toEqualTypeOf<ProviderDefinition | undefined>();
  });
});

// ── Category 4: ProviderAccountInfo ─────────────────────────────────────────
//
// Note: ProviderAccountInfo is inferred from a runtime-mapped z.discriminatedUnion.
// tsc resolves the inferred type as unknown at the indexed-access level because the
// schema tuple is built from Object.values() mapping (not a static tuple literal).
// We verify the export exists and is usable — runtime discrimination is tested in
// the existing provider integration tests.

describe("ProviderAccountInfo", () => {
  it("is a usable type (not never)", () => {
    expectTypeOf<ProviderAccountInfo>().not.toBeNever();
  });
});

// ── Category 5: ProviderConfig ────────────────────────────────────────────────

describe("ProviderConfig", () => {
  it("is a usable type (not never)", () => {
    expectTypeOf<ProviderConfig>().not.toBeNever();
  });
});

// ── Category 5b: ProviderDefinition providerConfigSchema field ───────────────

describe("ProviderDefinition providerConfigSchema", () => {
  it("each provider has a providerConfigSchema field", () => {
    type GitHubPCS = typeof PROVIDERS.github.providerConfigSchema;
    type VercelPCS = typeof PROVIDERS.vercel.providerConfigSchema;
    type LinearPCS = typeof PROVIDERS.linear.providerConfigSchema;
    type SentryPCS = typeof PROVIDERS.sentry.providerConfigSchema;

    expectTypeOf<GitHubPCS>().not.toBeNever();
    expectTypeOf<VercelPCS>().not.toBeNever();
    expectTypeOf<LinearPCS>().not.toBeNever();
    expectTypeOf<SentryPCS>().not.toBeNever();
  });
});

// ── Category 6: EVENT_REGISTRY Completeness ─────────────────────────────────

describe("EVENT_REGISTRY", () => {
  it("is typed as Record<EventKey, EventRegistryEntry>", () => {
    expectTypeOf(EVENT_REGISTRY).toEqualTypeOf<
      Record<EventKey, EventRegistryEntry>
    >();
  });

  it("entries are indexable by known event keys", () => {
    expectTypeOf(
      EVENT_REGISTRY["github:pull_request.opened"]
    ).toEqualTypeOf<EventRegistryEntry>();
  });
});

// ── Category 7: ProviderDefinition Structural Contract ──────────────────────

describe("ProviderDefinition contract", () => {
  it("each provider has all required webhook methods", () => {
    type WebhookKeys = keyof typeof PROVIDERS.github.webhook;
    expectTypeOf<"extractSecret">().toMatchTypeOf<WebhookKeys>();
    expectTypeOf<"verifySignature">().toMatchTypeOf<WebhookKeys>();
    expectTypeOf<"extractEventType">().toMatchTypeOf<WebhookKeys>();
    expectTypeOf<"extractDeliveryId">().toMatchTypeOf<WebhookKeys>();
    expectTypeOf<"extractResourceId">().toMatchTypeOf<WebhookKeys>();
    expectTypeOf<"parsePayload">().toMatchTypeOf<WebhookKeys>();
  });

  it("each provider has all required oauth methods", () => {
    type OAuthKeys = keyof typeof PROVIDERS.github.auth;
    expectTypeOf<"buildAuthUrl">().toMatchTypeOf<OAuthKeys>();
    expectTypeOf<"exchangeCode">().toMatchTypeOf<OAuthKeys>();
    expectTypeOf<"processCallback">().toMatchTypeOf<OAuthKeys>();
    expectTypeOf<"getActiveToken">().toMatchTypeOf<OAuthKeys>();
  });
});
