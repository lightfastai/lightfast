/**
 * Sentry backfill unit tests
 *
 * Tests for parseSentryLinkCursor, buildRequest, processResponse, and the
 * adapter → transformer round-trip invariant.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

// Skip env validation for transitive @db/console imports
vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
});

import type { BackfillContext } from "../../define";
import {
  adaptSentryErrorForTransformer,
  adaptSentryIssueForTransformer,
  parseSentryLinkCursor,
  sentryBackfill,
} from "./backfill";
import { transformSentryError, transformSentryIssue } from "./transformers";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ctx: BackfillContext = {
  installationId: "install-abc123",
  resource: {
    providerResourceId: "12345",
    resourceName: "my-org/my-project",
  },
  since: "2026-01-01T00:00:00.000Z",
};

const transformContext = {
  deliveryId: "backfill-test",
  receivedAt: Date.now(),
};

/** Realistic Sentry issue from /api/0/organizations/{org}/issues/ */
const sentryListIssue = {
  id: "987654321",
  shortId: "MY-PROJECT-42",
  title: "ValueError: invalid literal for int() with base 10",
  culprit: "my_app.process_request",
  permalink: "https://my-org.sentry.io/issues/987654321/",
  level: "error",
  status: "unresolved",
  platform: "python",
  project: {
    id: "12345",
    name: "My Project",
    slug: "my-project",
    platform: "python",
  },
  type: "error",
  firstSeen: "2026-01-15T10:00:00.000Z",
  lastSeen: "2026-01-20T15:30:00.000Z",
  count: "47",
  userCount: 12,
  assignedTo: null,
  metadata: {
    type: "ValueError",
    value: "invalid literal for int() with base 10: 'foo'",
    filename: "my_app.py",
    function: "process_request",
  },
};

/** Realistic Sentry error event from /api/0/projects/{org}/{project}/events/ */
const sentryListErrorEvent = {
  eventID: "d5e8f1a2b3c4d5e6f7a8b9c0d1e2f3a4",
  title: "ValueError: invalid literal",
  message: "ValueError: invalid literal for int() with base 10: 'foo'",
  dateCreated: "2026-01-20T15:30:00.000Z",
  platform: "python",
  tags: [
    { key: "environment", value: "production" },
    { key: "release", value: "1.2.3" },
  ],
};

// ── parseSentryLinkCursor ─────────────────────────────────────────────────────

describe("parseSentryLinkCursor", () => {
  it("returns null for undefined header", () => {
    expect(parseSentryLinkCursor(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseSentryLinkCursor("")).toBeNull();
  });

  it("returns null when results=false on next rel", () => {
    const header =
      '<https://sentry.io/api/0/organizations/my-org/issues/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
      '<https://sentry.io/api/0/organizations/my-org/issues/?cursor=0:100:0>; rel="next"; results="false"; cursor="0:100:0"';
    expect(parseSentryLinkCursor(header)).toBeNull();
  });

  it("returns cursor string when results=true on next rel", () => {
    const cursor = "0:100:0";
    const header =
      `<https://sentry.io/api/0/organizations/my-org/issues/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ` +
      `<https://sentry.io/api/0/organizations/my-org/issues/?cursor=${cursor}>; rel="next"; results="true"; cursor="${cursor}"`;
    expect(parseSentryLinkCursor(header)).toBe(cursor);
  });

  it("returns null for malformed header", () => {
    expect(parseSentryLinkCursor("malformed header content")).toBeNull();
  });

  it("returns null when only previous rel exists", () => {
    const header =
      '<https://sentry.io/api/0/organizations/my-org/issues/?cursor=0:0:1>; rel="previous"; results="true"; cursor="0:0:1"';
    expect(parseSentryLinkCursor(header)).toBeNull();
  });

  it("handles attributes in different order", () => {
    const header =
      '<https://sentry.io/api/0/>; results="true"; rel="next"; cursor="1:100:0"';
    expect(parseSentryLinkCursor(header)).toBe("1:100:0");
  });
});

// ── issue.buildRequest ────────────────────────────────────────────────────────

describe("sentryBackfill.issue.buildRequest", () => {
  const issueHandler = sentryBackfill.entityTypes.issue!;

  it("produces correct organization_slug from resourceName", () => {
    const req = issueHandler.buildRequest(ctx, null);
    expect(req.pathParams?.organization_slug).toBe("my-org");
  });

  it("passes providerResourceId as project query param", () => {
    const req = issueHandler.buildRequest(ctx, null);
    expect(req.queryParams?.project).toBe("12345");
  });

  it("does not include cursor param when cursor is null", () => {
    const req = issueHandler.buildRequest(ctx, null);
    expect(req.queryParams).not.toHaveProperty("cursor");
  });

  it("passes cursor as query param when non-null", () => {
    const req = issueHandler.buildRequest(ctx, "0:100:0");
    expect(req.queryParams?.cursor).toBe("0:100:0");
  });

  it("includes since as start param", () => {
    const req = issueHandler.buildRequest(ctx, null);
    expect(req.queryParams?.start).toBe(ctx.since);
  });

  it("handles empty resourceName gracefully", () => {
    const ctxNoName: BackfillContext = {
      ...ctx,
      resource: { ...ctx.resource, resourceName: "" },
    };
    const req = issueHandler.buildRequest(ctxNoName, null);
    expect(req.pathParams?.organization_slug).toBe("");
  });
});

// ── error.buildRequest ────────────────────────────────────────────────────────

describe("sentryBackfill.error.buildRequest", () => {
  const errorHandler = sentryBackfill.entityTypes.error!;

  it("produces correct path params from resourceName split", () => {
    const req = errorHandler.buildRequest(ctx, null);
    expect(req.pathParams?.organization_slug).toBe("my-org");
    expect(req.pathParams?.project_slug).toBe("my-project");
  });

  it("does not include cursor when null", () => {
    const req = errorHandler.buildRequest(ctx, null);
    expect(req.queryParams).not.toHaveProperty("cursor");
  });

  it("passes cursor as query param when non-null", () => {
    const req = errorHandler.buildRequest(ctx, "0:50:0");
    expect(req.queryParams?.cursor).toBe("0:50:0");
  });
});

// ── issue.processResponse ─────────────────────────────────────────────────────

describe("sentryBackfill.issue.processResponse", () => {
  const issueHandler = sentryBackfill.entityTypes.issue!;

  it("parses valid issue list and returns events", () => {
    const result = issueHandler.processResponse([sentryListIssue], ctx, null);
    expect(result.rawCount).toBe(1);
    expect(result.events).toHaveLength(1);
  });

  it("event has correct deliveryId format", () => {
    const result = issueHandler.processResponse([sentryListIssue], ctx, null);
    const event = result.events[0]!;
    expect(event.deliveryId).toBe(
      `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-issue-${sentryListIssue.id}`
    );
  });

  it("event has eventType=issue", () => {
    const result = issueHandler.processResponse([sentryListIssue], ctx, null);
    expect(result.events[0]!.eventType).toBe("issue");
  });

  it("extracts cursor from Link header when results=true", () => {
    const cursor = "0:100:0";
    const linkHeader = `<https://sentry.io/api/0/organizations/my-org/issues/?cursor=${cursor}>; rel="next"; results="true"; cursor="${cursor}"`;
    const result = issueHandler.processResponse([sentryListIssue], ctx, null, {
      link: linkHeader,
    });
    expect(result.nextCursor).toBe(cursor);
  });

  it("returns null cursor when no Link header", () => {
    const result = issueHandler.processResponse([sentryListIssue], ctx, null);
    expect(result.nextCursor).toBeNull();
  });

  it("returns null cursor when results=false", () => {
    const linkHeader =
      '<https://sentry.io/api/0/>; rel="next"; results="false"; cursor="0:100:0"';
    const result = issueHandler.processResponse([sentryListIssue], ctx, null, {
      link: linkHeader,
    });
    expect(result.nextCursor).toBeNull();
  });

  it("throws on invalid data", () => {
    expect(() =>
      issueHandler.processResponse([{ invalid: true }], ctx, null)
    ).toThrow();
  });
});

// ── error.processResponse ─────────────────────────────────────────────────────

describe("sentryBackfill.error.processResponse", () => {
  const errorHandler = sentryBackfill.entityTypes.error!;

  it("parses valid error event list and returns events", () => {
    const result = errorHandler.processResponse(
      [sentryListErrorEvent],
      ctx,
      null
    );
    expect(result.rawCount).toBe(1);
    expect(result.events).toHaveLength(1);
  });

  it("event has correct deliveryId format", () => {
    const result = errorHandler.processResponse(
      [sentryListErrorEvent],
      ctx,
      null
    );
    const event = result.events[0]!;
    expect(event.deliveryId).toBe(
      `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-error-${sentryListErrorEvent.eventID}`
    );
  });

  it("event has eventType=error", () => {
    const result = errorHandler.processResponse(
      [sentryListErrorEvent],
      ctx,
      null
    );
    expect(result.events[0]!.eventType).toBe("error");
  });

  it("extracts cursor from Link header", () => {
    const cursor = "0:50:0";
    const linkHeader = `<https://sentry.io/api/0/projects/my-org/my-project/events/?cursor=${cursor}>; rel="next"; results="true"; cursor="${cursor}"`;
    const result = errorHandler.processResponse(
      [sentryListErrorEvent],
      ctx,
      null,
      { link: linkHeader }
    );
    expect(result.nextCursor).toBe(cursor);
  });
});

// ── Round-trip: adapter → transformer ────────────────────────────────────────

describe("Sentry Issue: adapter → transformer round-trip", () => {
  let adapted: ReturnType<typeof adaptSentryIssueForTransformer>;

  beforeAll(() => {
    adapted = adaptSentryIssueForTransformer(
      sentryListIssue as unknown as Parameters<
        typeof adaptSentryIssueForTransformer
      >[0],
      ctx
    );
  });

  it("transformer does not throw", () => {
    expect(() =>
      transformSentryIssue(adapted, transformContext, "issue")
    ).not.toThrow();
  });

  it("produces a PostTransformEvent with non-empty sourceId", () => {
    const event = transformSentryIssue(adapted, transformContext, "issue");
    expect(event.sourceId.length).toBeGreaterThan(0);
  });

  it("source is sentry", () => {
    const event = transformSentryIssue(adapted, transformContext, "issue");
    expect(event.provider).toBe("sentry");
  });

  it("title is non-empty", () => {
    const event = transformSentryIssue(adapted, transformContext, "issue");
    expect(event.title).toBeTruthy();
  });

  it("sourceId contains project slug and shortId", () => {
    const event = transformSentryIssue(adapted, transformContext, "issue");
    expect(event.sourceId).toContain("my-project");
    expect(event.sourceId).toContain("MY-PROJECT-42");
  });

  it("occurredAt is a valid ISO timestamp", () => {
    const event = transformSentryIssue(adapted, transformContext, "issue");
    expect(new Date(event.occurredAt).getTime()).not.toBeNaN();
  });

  it("sourceType includes action", () => {
    const event = transformSentryIssue(adapted, transformContext, "issue");
    expect(event.eventType).toContain("created");
  });

  it("resolved issue maps to resolved action", () => {
    const resolvedIssue = { ...sentryListIssue, status: "resolved" };
    const resolvedAdapted = adaptSentryIssueForTransformer(
      resolvedIssue as unknown as Parameters<
        typeof adaptSentryIssueForTransformer
      >[0],
      ctx
    );
    const event = transformSentryIssue(
      resolvedAdapted,
      transformContext,
      "issue"
    );
    expect(event.eventType).toContain("resolved");
  });

  it("ignored issue maps to ignored action", () => {
    const ignoredIssue = { ...sentryListIssue, status: "ignored" };
    const ignoredAdapted = adaptSentryIssueForTransformer(
      ignoredIssue as unknown as Parameters<
        typeof adaptSentryIssueForTransformer
      >[0],
      ctx
    );
    const event = transformSentryIssue(
      ignoredAdapted,
      transformContext,
      "issue"
    );
    expect(event.eventType).toContain("ignored");
  });
});

describe("Sentry Error: adapter → transformer round-trip", () => {
  let adapted: ReturnType<typeof adaptSentryErrorForTransformer>;

  beforeAll(() => {
    adapted = adaptSentryErrorForTransformer(
      sentryListErrorEvent as unknown as Parameters<
        typeof adaptSentryErrorForTransformer
      >[0],
      ctx
    );
  });

  it("transformer does not throw", () => {
    expect(() =>
      transformSentryError(adapted, transformContext, "error")
    ).not.toThrow();
  });

  it("produces a PostTransformEvent with non-empty sourceId", () => {
    const event = transformSentryError(adapted, transformContext, "error");
    expect(event.sourceId.length).toBeGreaterThan(0);
  });

  it("source is sentry", () => {
    const event = transformSentryError(adapted, transformContext, "error");
    expect(event.provider).toBe("sentry");
  });

  it("sourceId contains eventID", () => {
    const event = transformSentryError(adapted, transformContext, "error");
    expect(event.sourceId).toContain(sentryListErrorEvent.eventID);
  });

  it("occurredAt is a valid ISO timestamp", () => {
    const event = transformSentryError(adapted, transformContext, "error");
    expect(new Date(event.occurredAt).getTime()).not.toBeNaN();
  });

  it("title is non-empty", () => {
    const event = transformSentryError(adapted, transformContext, "error");
    expect(event.title).toBeTruthy();
  });

  it("passes through rich fields from full=true response", () => {
    const richEvent = {
      ...sentryListErrorEvent,
      culprit: "my_app.views.process",
      location: "my_app/views.py",
      web_url: "https://my-org.sentry.io/issues/123/events/abc/",
      user: { id: "user-1", email: "alice@example.com", username: "alice" },
      sdk: { name: "sentry.python", version: "1.40.0" },
      metadata: { type: "ValueError", value: "bad input" },
      exception: {
        values: [
          {
            type: "ValueError",
            value: "bad input",
            stacktrace: {
              frames: [{ filename: "app.py", lineno: 42, function: "run" }],
            },
          },
        ],
      },
    };
    const richAdapted = adaptSentryErrorForTransformer(
      richEvent as unknown as Parameters<
        typeof adaptSentryErrorForTransformer
      >[0],
      ctx
    );
    const result = transformSentryError(richAdapted, transformContext, "error");
    expect(result.attributes.culprit).toBe("my_app.views.process");
    expect(result.attributes.webUrl).toBe(
      "https://my-org.sentry.io/issues/123/events/abc/"
    );
  });
});
