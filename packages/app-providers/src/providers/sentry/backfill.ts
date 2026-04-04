import { z } from "zod";
import type { BackfillContext, BackfillDef } from "../../provider/backfill";
import { typedEntityHandler } from "../../provider/backfill";
import {
  type SentryErrorEvent,
  type SentryIssue,
  sentryErrorEventSchema,
  sentryIssueSchema,
} from "./api";
import type {
  PreTransformSentryErrorWebhook,
  PreTransformSentryIssueWebhook,
} from "./schemas";

// ── Link header cursor parser ─────────────────────────────────────────────────

/** Parse Sentry's RFC 5988 Link header to extract the next page cursor.
 *  Returns null if no next page (results="false") or header is missing.
 *  Handles attribute ordering variations — Sentry puts rel/results/cursor
 *  in a consistent order today, but RFC 5988 doesn't mandate it. */
export function parseSentryLinkCursor(linkHeader?: string): string | null {
  if (!linkHeader) {
    return null;
  }
  // Split on comma to isolate each link value, then find the "next" one
  const parts = linkHeader.split(",").map((s) => s.trim());
  for (const part of parts) {
    if (!part.includes('rel="next"')) {
      continue;
    }
    if (!part.includes('results="true"')) {
      return null; // next exists but no more results
    }
    const cursorMatch = part.match(/cursor="([^"]+)"/);
    return cursorMatch?.[1] ?? null;
  }
  return null;
}

// ── Adapter Functions ─────────────────────────────────────────────────────────

const STATUS_TO_ACTION = {
  unresolved: "created",
  resolved: "resolved",
  ignored: "ignored",
} as const;

export function adaptSentryIssueForTransformer(
  issue: SentryIssue,
  ctx: BackfillContext
): PreTransformSentryIssueWebhook {
  const metadata = issue.metadata;
  const action = STATUS_TO_ACTION[issue.status] ?? "created";
  return {
    action,
    data: {
      issue: {
        id: issue.id,
        shortId: issue.shortId,
        title: issue.title,
        culprit: issue.culprit ?? null,
        status: issue.status,
        level: issue.level ?? "error",
        platform: issue.platform ?? "other",
        firstSeen: issue.firstSeen,
        lastSeen: issue.lastSeen,
        count: issue.count,
        userCount: issue.userCount,
        permalink: issue.permalink ?? null,
        metadata: {
          type: metadata?.type,
          value: metadata?.value ?? issue.title,
          filename: metadata?.filename,
          function: metadata?.function,
        },
        project: {
          id: issue.project.id,
          name: issue.project.name ?? issue.project.slug,
          slug: issue.project.slug,
        },
        assignedTo: issue.assignedTo ?? null,
        statusDetails: {},
        type: issue.type ?? "error",
        annotations: [],
        isPublic: false,
        isBookmarked: false,
        isSubscribed: false,
        hasSeen: false,
        numComments: 0,
      },
    },
    installation: { uuid: ctx.installationId },
  } satisfies PreTransformSentryIssueWebhook;
}

export function adaptSentryErrorForTransformer(
  event: SentryErrorEvent,
  ctx: BackfillContext
): PreTransformSentryErrorWebhook {
  const projectId = Number(ctx.resource.providerResourceId);
  return {
    action: "created",
    data: {
      error: {
        event_id: event.eventID,
        project: Number.isNaN(projectId) ? 0 : projectId,
        timestamp: event.dateCreated,
        received: event.dateCreated,
        platform: event.platform ?? "other",
        message: event.message ?? "",
        title: event.title ?? event.message ?? "",
        type: "error",
        metadata: {
          type: event.metadata?.type,
          value: event.metadata?.value ?? event.message,
          filename: event.metadata?.filename,
          function: event.metadata?.function,
        },
        tags: event.tags ?? [],
        // Rich fields from full=true — transformer uses these when present
        ...(event.exception ? { exception: event.exception } : {}),
        ...(event.user ? { user: event.user } : {}),
        ...(event.sdk ? { sdk: event.sdk } : {}),
        ...(event.culprit ? { culprit: event.culprit } : {}),
        ...(event.location ? { location: event.location } : {}),
        ...(event.web_url ? { web_url: event.web_url } : {}),
      },
    },
    installation: { uuid: ctx.installationId },
  } satisfies PreTransformSentryErrorWebhook;
}

// ── Backfill Definition ───────────────────────────────────────────────────────

export const sentryBackfill: BackfillDef = {
  supportedEntityTypes: ["issue", "error"],
  defaultEntityTypes: ["issue", "error"],
  resolveResourceMeta: async ({ providerResourceId, token }) => {
    // Step 1: Get org slug — token is org-scoped, so this returns one org
    const orgRes = await fetch("https://sentry.io/api/0/organizations/", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!orgRes.ok) {
      throw new Error(`Sentry org lookup failed: ${orgRes.status}`);
    }
    const orgs = (await orgRes.json()) as Array<{ slug: string }>;
    const orgSlug = orgs[0]?.slug;
    if (!orgSlug) {
      throw new Error("Sentry org not found for token");
    }

    // Step 2: Get project slug — paginate org projects to find by numeric ID
    let nextUrl: string | null =
      `https://sentry.io/api/0/organizations/${orgSlug}/projects/?per_page=100`;
    while (nextUrl) {
      const pageRes: Response = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!pageRes.ok) {
        throw new Error(`Sentry project lookup failed: ${pageRes.status}`);
      }
      const projects = (await pageRes.json()) as Array<{
        id: string;
        slug: string;
      }>;
      const project = projects.find((p) => p.id === providerResourceId);
      if (project) {
        return `${orgSlug}/${project.slug}`;
      }
      // Parse Link header for next page
      const linkHeader: string = pageRes.headers.get("link") ?? "";
      const nextMatch = linkHeader.match(
        /<([^>]+)>;\s*rel="next";\s*results="true"/
      );
      nextUrl = nextMatch?.[1] ?? null;
    }
    throw new Error(`Sentry project not found: ${providerResourceId}`);
  },
  entityTypes: {
    issue: typedEntityHandler<string>({
      endpointId: "list-org-issues",
      buildRequest(ctx: BackfillContext, cursor: string | null) {
        // resourceName format: "orgSlug/projectSlug" (set during resource linking)
        const [orgSlug = ""] = ctx.resource.resourceName.split("/");
        const cursorStr = typeof cursor === "string" ? cursor : undefined;
        return {
          pathParams: { organization_slug: orgSlug },
          queryParams: {
            project: ctx.resource.providerResourceId,
            start: ctx.since,
            end: new Date().toISOString(),
            sort: "new",
            query: "",
            limit: "100",
            collapse: "stats",
            ...(cursorStr ? { cursor: cursorStr } : {}),
          },
        };
      },
      processResponse(
        data: unknown,
        ctx: BackfillContext,
        _cursor: string | null,
        responseHeaders?: Record<string, string>
      ) {
        const issues = z.array(sentryIssueSchema).parse(data);
        const nextCursor = parseSentryLinkCursor(responseHeaders?.link);
        const events = issues.map((issue) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-issue-${issue.id}`,
          eventType: "issue",
          payload: adaptSentryIssueForTransformer(issue, ctx),
        }));
        return { events, nextCursor, rawCount: issues.length };
      },
    }),
    error: typedEntityHandler<string>({
      endpointId: "list-events",
      buildRequest(ctx: BackfillContext, cursor: string | null) {
        // resourceName format: "orgSlug/projectSlug" (set during resource linking)
        const [orgSlug = "", projectSlug = ""] =
          ctx.resource.resourceName.split("/");
        const cursorStr = typeof cursor === "string" ? cursor : undefined;
        return {
          pathParams: {
            organization_slug: orgSlug,
            project_slug: projectSlug,
          },
          queryParams: {
            start: ctx.since,
            end: new Date().toISOString(),
            full: "true",
            ...(cursorStr ? { cursor: cursorStr } : {}),
          },
        };
      },
      processResponse(
        data: unknown,
        ctx: BackfillContext,
        _cursor: string | null,
        responseHeaders?: Record<string, string>
      ) {
        const events = z.array(sentryErrorEventSchema).parse(data);
        const nextCursor = parseSentryLinkCursor(responseHeaders?.link);
        const adapted = events.map((event) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-error-${event.eventID}`,
          eventType: "error",
          payload: adaptSentryErrorForTransformer(event, ctx),
        }));
        return { events: adapted, nextCursor, rawCount: events.length };
      },
    }),
  },
};
