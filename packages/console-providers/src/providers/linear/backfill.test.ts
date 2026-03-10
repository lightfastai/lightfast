/**
 * Linear backfill unit tests
 *
 * Covers:
 * - buildRequest variable construction and cursor handling
 * - processResponse Zod validation and pagination
 * - Adapter → transformer round-trip for Issue, Comment, Project
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

// Skip env validation for transitive @db/console imports
vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
});

import type { BackfillContext } from "../../define";
import {
  adaptLinearCommentForTransformer,
  adaptLinearIssueForTransformer,
  adaptLinearProjectForTransformer,
  linearBackfill,
} from "./backfill";
import {
  transformLinearComment,
  transformLinearIssue,
  transformLinearProject,
} from "./transformers";

// ── Test fixtures ──────────────────────────────────────────────────────────────

const ctx: BackfillContext = {
  installationId: "inst-abc",
  resource: {
    providerResourceId: "team-123",
    resourceName: "Engineering",
  },
  since: "2026-01-01T00:00:00.000Z",
};

const transformCtx = {
  deliveryId: "backfill-roundtrip-test",
  receivedAt: Date.now(),
};

const issueNode = {
  id: "issue-abc",
  identifier: "ENG-42",
  title: "Fix the backfill pipeline",
  description: "Implements historical data backfill.",
  priority: 2,
  url: "https://linear.app/team/issue/ENG-42",
  createdAt: "2026-01-10T10:00:00.000Z",
  updatedAt: "2026-01-15T12:00:00.000Z",
  state: { id: "state-1", name: "In Progress", type: "started" },
  assignee: { id: "user-1", name: "Alice", email: "alice@example.com" },
  team: { id: "team-123", key: "ENG", name: "Engineering" },
  project: { id: "proj-1", name: "Backfill Project" },
  labels: { nodes: [{ id: "label-1", name: "bug" }] },
};

const commentNode = {
  id: "comment-xyz",
  body: "This is a comment on the issue.",
  createdAt: "2026-01-12T09:00:00.000Z",
  updatedAt: "2026-01-12T09:30:00.000Z",
  user: { id: "user-2", name: "Bob" },
  issue: { id: "issue-abc", identifier: "ENG-42", title: "Fix the backfill pipeline" },
};

const projectNode = {
  id: "proj-1",
  name: "Backfill Project",
  description: "A project for testing backfill.",
  state: "started",
  url: "https://linear.app/team/project/backfill-project",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-20T08:00:00.000Z",
  lead: { id: "user-1", name: "Alice" },
  startDate: "2026-01-01",
  targetDate: "2026-03-31",
};

// ── buildRequest: Issue ────────────────────────────────────────────────────────

describe("Issue buildRequest", () => {
  it("includes teamId and since variables", () => {
    const req = linearBackfill.entityTypes.Issue!.buildRequest(ctx, null);
    const body = req.body as { variables: Record<string, unknown> };
    expect(body.variables.teamId).toBe("team-123");
    expect(body.variables.since).toBe("2026-01-01T00:00:00.000Z");
  });

  it("sets after to undefined when cursor is null", () => {
    const req = linearBackfill.entityTypes.Issue!.buildRequest(ctx, null);
    const body = req.body as { variables: Record<string, unknown> };
    expect(body.variables.after).toBeUndefined();
  });

  it("passes cursor as after variable when non-null", () => {
    const req = linearBackfill.entityTypes.Issue!.buildRequest(
      ctx,
      "cursor-abc"
    );
    const body = req.body as { variables: Record<string, unknown> };
    expect(body.variables.after).toBe("cursor-abc");
  });

  it("uses graphql endpointId", () => {
    expect(linearBackfill.entityTypes.Issue!.endpointId).toBe("graphql");
  });

  it("query contains BackfillIssues", () => {
    const req = linearBackfill.entityTypes.Issue!.buildRequest(ctx, null);
    const body = req.body as { query: string };
    expect(body.query).toContain("BackfillIssues");
  });
});

// ── buildRequest: Comment ──────────────────────────────────────────────────────

describe("Comment buildRequest", () => {
  it("includes teamId and since variables", () => {
    const req = linearBackfill.entityTypes.Comment!.buildRequest(ctx, null);
    const body = req.body as { variables: Record<string, unknown> };
    expect(body.variables.teamId).toBe("team-123");
    expect(body.variables.since).toBe("2026-01-01T00:00:00.000Z");
  });

  it("sets after to undefined when cursor is null", () => {
    const req = linearBackfill.entityTypes.Comment!.buildRequest(ctx, null);
    const body = req.body as { variables: Record<string, unknown> };
    expect(body.variables.after).toBeUndefined();
  });

  it("passes cursor as after variable when non-null", () => {
    const req = linearBackfill.entityTypes.Comment!.buildRequest(
      ctx,
      "cursor-def"
    );
    const body = req.body as { variables: Record<string, unknown> };
    expect(body.variables.after).toBe("cursor-def");
  });

  it("query contains BackfillComments", () => {
    const req = linearBackfill.entityTypes.Comment!.buildRequest(ctx, null);
    const body = req.body as { query: string };
    expect(body.query).toContain("BackfillComments");
  });
});

// ── buildRequest: Project ──────────────────────────────────────────────────────

describe("Project buildRequest", () => {
  it("includes teamId and since variables", () => {
    const req = linearBackfill.entityTypes.Project!.buildRequest(ctx, null);
    const body = req.body as { variables: Record<string, unknown> };
    expect(body.variables.teamId).toBe("team-123");
    expect(body.variables.since).toBe("2026-01-01T00:00:00.000Z");
  });

  it("passes cursor as after variable when non-null", () => {
    const req = linearBackfill.entityTypes.Project!.buildRequest(
      ctx,
      "cursor-ghi"
    );
    const body = req.body as { variables: Record<string, unknown> };
    expect(body.variables.after).toBe("cursor-ghi");
  });

  it("query contains BackfillProjects", () => {
    const req = linearBackfill.entityTypes.Project!.buildRequest(ctx, null);
    const body = req.body as { query: string };
    expect(body.query).toContain("BackfillProjects");
  });
});

// ── processResponse: Issue ────────────────────────────────────────────────────

describe("Issue processResponse", () => {
  function makeIssuesResponse(
    nodes: unknown[],
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
  ) {
    return { data: { issues: { nodes, pageInfo } } };
  }

  it("returns events with correct deliveryId and eventType", () => {
    const data = makeIssuesResponse([issueNode], {
      hasNextPage: false,
      endCursor: null,
    });
    const result = linearBackfill.entityTypes.Issue!.processResponse(
      data,
      ctx,
      null
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.deliveryId).toBe(
      "backfill-inst-abc-team-123-issue-issue-abc"
    );
    expect(result.events[0]!.eventType).toBe("Issue");
  });

  it("nextCursor is null when hasNextPage is false", () => {
    const data = makeIssuesResponse([issueNode], {
      hasNextPage: false,
      endCursor: null,
    });
    const result = linearBackfill.entityTypes.Issue!.processResponse(
      data,
      ctx,
      null
    );
    expect(result.nextCursor).toBeNull();
  });

  it("nextCursor is endCursor when hasNextPage is true", () => {
    const data = makeIssuesResponse([issueNode], {
      hasNextPage: true,
      endCursor: "page-2-cursor",
    });
    const result = linearBackfill.entityTypes.Issue!.processResponse(
      data,
      ctx,
      null
    );
    expect(result.nextCursor).toBe("page-2-cursor");
  });

  it("rawCount equals the number of nodes returned", () => {
    const data = makeIssuesResponse([issueNode, issueNode], {
      hasNextPage: false,
      endCursor: null,
    });
    const result = linearBackfill.entityTypes.Issue!.processResponse(
      data,
      ctx,
      null
    );
    expect(result.rawCount).toBe(2);
  });

  it("throws on invalid data shape", () => {
    expect(() =>
      linearBackfill.entityTypes.Issue!.processResponse(
        { invalid: true },
        ctx,
        null
      )
    ).toThrow();
  });
});

// ── processResponse: Comment ──────────────────────────────────────────────────

describe("Comment processResponse", () => {
  function makeCommentsResponse(
    nodes: unknown[],
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
  ) {
    return { data: { comments: { nodes, pageInfo } } };
  }

  it("returns events with correct deliveryId and eventType", () => {
    const data = makeCommentsResponse([commentNode], {
      hasNextPage: false,
      endCursor: null,
    });
    const result = linearBackfill.entityTypes.Comment!.processResponse(
      data,
      ctx,
      null
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.deliveryId).toBe(
      "backfill-inst-abc-team-123-comment-comment-xyz"
    );
    expect(result.events[0]!.eventType).toBe("Comment");
  });

  it("nextCursor is null when hasNextPage is false", () => {
    const data = makeCommentsResponse([commentNode], {
      hasNextPage: false,
      endCursor: null,
    });
    const result = linearBackfill.entityTypes.Comment!.processResponse(
      data,
      ctx,
      null
    );
    expect(result.nextCursor).toBeNull();
  });

  it("nextCursor is endCursor when hasNextPage is true", () => {
    const data = makeCommentsResponse([commentNode], {
      hasNextPage: true,
      endCursor: "comment-cursor-next",
    });
    const result = linearBackfill.entityTypes.Comment!.processResponse(
      data,
      ctx,
      null
    );
    expect(result.nextCursor).toBe("comment-cursor-next");
  });
});

// ── processResponse: Project ──────────────────────────────────────────────────

describe("Project processResponse", () => {
  function makeProjectsResponse(
    nodes: unknown[],
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
  ) {
    return { data: { projects: { nodes, pageInfo } } };
  }

  it("returns events with correct deliveryId and eventType", () => {
    const data = makeProjectsResponse([projectNode], {
      hasNextPage: false,
      endCursor: null,
    });
    const result = linearBackfill.entityTypes.Project!.processResponse(
      data,
      ctx,
      null
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.deliveryId).toBe(
      "backfill-inst-abc-team-123-project-proj-1"
    );
    expect(result.events[0]!.eventType).toBe("Project");
  });

  it("nextCursor is null when hasNextPage is false", () => {
    const data = makeProjectsResponse([projectNode], {
      hasNextPage: false,
      endCursor: null,
    });
    const result = linearBackfill.entityTypes.Project!.processResponse(
      data,
      ctx,
      null
    );
    expect(result.nextCursor).toBeNull();
  });

  it("nextCursor is endCursor when hasNextPage is true", () => {
    const data = makeProjectsResponse([projectNode], {
      hasNextPage: true,
      endCursor: "proj-cursor",
    });
    const result = linearBackfill.entityTypes.Project!.processResponse(
      data,
      ctx,
      null
    );
    expect(result.nextCursor).toBe("proj-cursor");
  });
});

// ── Round-trip: Issue ─────────────────────────────────────────────────────────

describe("Linear Issue: adapter → transformer round-trip", () => {
  let adapted: ReturnType<typeof adaptLinearIssueForTransformer>;

  beforeAll(() => {
    adapted = adaptLinearIssueForTransformer(issueNode, ctx);
  });

  it("transformer does not throw", () => {
    expect(() =>
      transformLinearIssue(adapted, transformCtx, "")
    ).not.toThrow();
  });

  it("produces a PostTransformEvent with non-empty sourceId", () => {
    const event = transformLinearIssue(adapted, transformCtx, "");
    expect(event.sourceId.length).toBeGreaterThan(0);
  });

  it("source is linear", () => {
    const event = transformLinearIssue(adapted, transformCtx, "");
    expect(event.source).toBe("linear");
  });

  it("title contains issue identifier", () => {
    const event = transformLinearIssue(adapted, transformCtx, "");
    expect(event.title).toContain("ENG-42");
  });

  it("occurredAt is a valid parseable ISO timestamp", () => {
    const event = transformLinearIssue(adapted, transformCtx, "");
    const parsed = new Date(event.occurredAt);
    expect(parsed.getTime()).not.toBeNaN();
  });

  it("body contains priority label for priority 2 (High)", () => {
    const event = transformLinearIssue(adapted, transformCtx, "");
    expect(event.body).toContain("High");
  });

  it("sourceId contains team key extracted from identifier", () => {
    const event = transformLinearIssue(adapted, transformCtx, "");
    expect(event.sourceId).toContain("ENG");
    expect(event.sourceId).not.toContain("::");
  });

  it("sourceType contains 'created' for action create", () => {
    const event = transformLinearIssue(adapted, transformCtx, "");
    expect(event.sourceType).toContain("created");
  });

  it("metadata contains issueId", () => {
    const event = transformLinearIssue(adapted, transformCtx, "");
    expect(event.metadata.issueId).toBe("issue-abc");
  });
});

// ── Round-trip: Comment ───────────────────────────────────────────────────────

describe("Linear Comment: adapter → transformer round-trip", () => {
  let adapted: ReturnType<typeof adaptLinearCommentForTransformer>;

  beforeAll(() => {
    adapted = adaptLinearCommentForTransformer(commentNode, ctx);
  });

  it("transformer does not throw", () => {
    expect(() =>
      transformLinearComment(adapted, transformCtx, "")
    ).not.toThrow();
  });

  it("produces a PostTransformEvent with non-empty sourceId", () => {
    const event = transformLinearComment(adapted, transformCtx, "");
    expect(event.sourceId.length).toBeGreaterThan(0);
  });

  it("source is linear", () => {
    const event = transformLinearComment(adapted, transformCtx, "");
    expect(event.source).toBe("linear");
  });

  it("title contains issue identifier", () => {
    const event = transformLinearComment(adapted, transformCtx, "");
    expect(event.title).toContain("ENG-42");
  });

  it("actor is populated from comment.user", () => {
    const event = transformLinearComment(adapted, transformCtx, "");
    expect(event.actor).toBeDefined();
    expect(event.actor!.name).toBe("Bob");
  });

  it("sourceType contains 'created'", () => {
    const event = transformLinearComment(adapted, transformCtx, "");
    expect(event.sourceType).toContain("created");
  });

  it("metadata contains commentId", () => {
    const event = transformLinearComment(adapted, transformCtx, "");
    expect(event.metadata.commentId).toBe("comment-xyz");
  });
});

// ── Round-trip: Project ───────────────────────────────────────────────────────

describe("Linear Project: adapter → transformer round-trip", () => {
  let adapted: ReturnType<typeof adaptLinearProjectForTransformer>;

  beforeAll(() => {
    adapted = adaptLinearProjectForTransformer(projectNode, ctx);
  });

  it("transformer does not throw", () => {
    expect(() =>
      transformLinearProject(adapted, transformCtx, "")
    ).not.toThrow();
  });

  it("produces a PostTransformEvent with non-empty sourceId", () => {
    const event = transformLinearProject(adapted, transformCtx, "");
    expect(event.sourceId.length).toBeGreaterThan(0);
  });

  it("source is linear", () => {
    const event = transformLinearProject(adapted, transformCtx, "");
    expect(event.source).toBe("linear");
  });

  it("title contains project name", () => {
    const event = transformLinearProject(adapted, transformCtx, "");
    expect(event.title).toContain("Backfill Project");
  });

  it("occurredAt is a valid parseable ISO timestamp", () => {
    const event = transformLinearProject(adapted, transformCtx, "");
    const parsed = new Date(event.occurredAt);
    expect(parsed.getTime()).not.toBeNaN();
  });

  it("sourceType contains 'created'", () => {
    const event = transformLinearProject(adapted, transformCtx, "");
    expect(event.sourceType).toContain("created");
  });

  it("metadata contains projectId", () => {
    const event = transformLinearProject(adapted, transformCtx, "");
    expect(event.metadata.projectId).toBe("proj-1");
  });
});

// ── linearBackfill definition ──────────────────────────────────────────────────

describe("linearBackfill definition", () => {
  it("supportedEntityTypes includes Issue, Comment, Project", () => {
    expect(linearBackfill.supportedEntityTypes).toContain("Issue");
    expect(linearBackfill.supportedEntityTypes).toContain("Comment");
    expect(linearBackfill.supportedEntityTypes).toContain("Project");
  });

  it("defaultEntityTypes includes Issue, Comment, Project", () => {
    expect(linearBackfill.defaultEntityTypes).toContain("Issue");
    expect(linearBackfill.defaultEntityTypes).toContain("Comment");
    expect(linearBackfill.defaultEntityTypes).toContain("Project");
  });

  it("all entity handlers use graphql endpointId", () => {
    expect(linearBackfill.entityTypes.Issue!.endpointId).toBe("graphql");
    expect(linearBackfill.entityTypes.Comment!.endpointId).toBe("graphql");
    expect(linearBackfill.entityTypes.Project!.endpointId).toBe("graphql");
  });
});
