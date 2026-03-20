import { z } from "zod";
import type { ProviderApi, RateLimit } from "../../provider/api";

// ── Rate Limit Parser ───────────────────────────────────────────────────────────

export function parseSentryRateLimit(headers: Headers): RateLimit | null {
  const remaining = headers.get("x-sentry-rate-limit-remaining");
  const limit = headers.get("x-sentry-rate-limit-limit");
  const reset = headers.get("x-sentry-rate-limit-reset");
  if (!(remaining && limit && reset)) {
    return null;
  }
  const r = Number.parseInt(remaining, 10);
  const l = Number.parseInt(limit, 10);
  const s = Number.parseFloat(reset); // UTC epoch SECONDS
  if (Number.isNaN(r) || Number.isNaN(l) || Number.isNaN(s)) {
    return null;
  }
  return { remaining: r, limit: l, resetAt: new Date(s * 1000) };
}

// ── Response Schemas ────────────────────────────────────────────────────────────

export const sentryIssueSchema = z
  .object({
    id: z.string(),
    shortId: z.string(),
    title: z.string(),
    culprit: z.string().nullable().optional(),
    permalink: z.string().nullable().optional(),
    level: z
      .enum(["fatal", "error", "warning", "info", "debug"])
      .catch("error")
      .optional(),
    status: z.enum(["unresolved", "resolved", "ignored"]).catch("unresolved"),
    platform: z.string().optional(),
    project: z
      .object({
        id: z.string(),
        name: z.string().optional(),
        slug: z.string(),
      })
      .loose(),
    type: z.enum(["error", "default"]).catch("error").optional(),
    firstSeen: z.string(),
    lastSeen: z.string(),
    count: z.string(),
    userCount: z.number(),
    assignedTo: z
      .object({
        type: z.string(),
        id: z.union([z.string(), z.number()]),
        name: z.string(),
      })
      .nullable()
      .optional(),
    metadata: z
      .object({
        type: z.string().optional(),
        value: z.string().optional(),
        filename: z.string().optional(),
        function: z.string().optional(),
        title: z.string().optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

export type SentryIssue = z.infer<typeof sentryIssueSchema>;

export const sentryErrorEventSchema = z
  .object({
    eventID: z.string(),
    title: z.string().optional(),
    message: z.string().optional(),
    dateCreated: z.string(),
    platform: z.string().optional(),
    tags: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
    metadata: z
      .object({
        type: z.string().optional(),
        value: z.string().optional(),
        filename: z.string().optional(),
        function: z.string().optional(),
      })
      .nullable()
      .optional(),
    exception: z
      .object({
        values: z.array(
          z.object({
            type: z.string(),
            value: z.string().optional(),
            stacktrace: z
              .object({
                frames: z.array(
                  z
                    .object({
                      filename: z.string().nullable().optional(),
                      function: z.string().nullable().optional(),
                      lineno: z.number().nullable().optional(),
                    })
                    .loose()
                ),
              })
              .optional(),
          })
        ),
      })
      .optional(),
    user: z
      .object({
        id: z.string().nullish(),
        email: z.string().nullish(),
        username: z.string().nullish(),
        ip_address: z.string().nullish(),
      })
      .nullish(),
    sdk: z.object({ name: z.string(), version: z.string() }).optional(),
    culprit: z.string().optional(),
    location: z.string().nullish(),
    web_url: z.string().optional(),
  })
  .loose();

export type SentryErrorEvent = z.infer<typeof sentryErrorEventSchema>;

// ── API Definition ──────────────────────────────────────────────────────────────

export const sentryProjectSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    platform: z.string().nullable().optional(),
    status: z.string().optional(),
    organization: z.object({ slug: z.string() }).loose(),
  })
  .loose();

export const sentryOrganizationSchema = z
  .object({
    name: z.string().optional(),
    slug: z.string().optional(),
  })
  .loose();

export const sentryApi = {
  baseUrl: "https://sentry.io",
  buildAuthHeader: (token: string) => `Bearer ${token}`,
  parseRateLimit: parseSentryRateLimit,
  endpoints: {
    "list-projects": {
      method: "GET",
      path: "/api/0/projects/",
      description: "List all projects in the Sentry organization",
      responseSchema: z.array(sentryProjectSchema),
    },
    "list-organizations": {
      method: "GET",
      path: "/api/0/organizations/",
      description: "List Sentry organizations for the authenticated user",
      responseSchema: z.array(sentryOrganizationSchema),
    },
    "list-org-issues": {
      method: "GET",
      path: "/api/0/organizations/{organization_slug}/issues/",
      description:
        "List issues for an organization (filter by project via query param)",
      responseSchema: z.array(sentryIssueSchema),
    },
    "list-events": {
      method: "GET",
      path: "/api/0/projects/{organization_slug}/{project_slug}/events/",
      description: "List error events for a Sentry project",
      responseSchema: z.array(sentryErrorEventSchema),
    },
  },
} as const satisfies ProviderApi;
