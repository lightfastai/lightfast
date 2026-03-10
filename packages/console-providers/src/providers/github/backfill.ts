import { z } from "zod";
import type {
  BackfillContext,
  BackfillDef,
  BackfillWebhookEvent,
} from "../../define";
import {
  githubIssueSchema,
  githubPullRequestSchema,
  githubReleaseSchema,
} from "./api";
import type {
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubReleaseEvent,
} from "./schemas";

// ── Adapter Functions ─────────────────────────────────────────────────────────────

export function adaptGitHubPRForTransformer(
  pr: Record<string, unknown>,
  repo: Record<string, unknown>
): PreTransformGitHubPullRequestEvent {
  const state = pr.state as string;
  const action = state === "open" ? "opened" : "closed";
  return {
    action,
    pull_request: pr,
    repository: repo,
    sender: pr.user,
  } as unknown as PreTransformGitHubPullRequestEvent;
}

export function adaptGitHubIssueForTransformer(
  issue: Record<string, unknown>,
  repo: Record<string, unknown>
): PreTransformGitHubIssuesEvent {
  const state = issue.state as string;
  const action = state === "open" ? "opened" : "closed";
  return {
    action,
    issue,
    repository: repo,
    sender: issue.user,
  } as unknown as PreTransformGitHubIssuesEvent;
}

export function adaptGitHubReleaseForTransformer(
  release: Record<string, unknown>,
  repo: Record<string, unknown>
): PreTransformGitHubReleaseEvent {
  return {
    action: "published",
    release,
    repository: repo,
    sender: release.author,
  } as unknown as PreTransformGitHubReleaseEvent;
}

// ── Helper ────────────────────────────────────────────────────────────────────────

function buildRepoData(ctx: BackfillContext): Record<string, unknown> {
  const repoFullName = ctx.resource.resourceName ?? "";
  const repoId = Number(ctx.resource.providerResourceId);
  return {
    full_name: repoFullName,
    html_url: `https://github.com/${repoFullName}`,
    id: repoId,
  };
}

// ── Backfill Definition ───────────────────────────────────────────────────────────

export const githubBackfill: BackfillDef = {
  supportedEntityTypes: ["pull_request", "issue", "release"],
  defaultEntityTypes: ["pull_request", "issue", "release"],
  entityTypes: {
    pull_request: {
      endpointId: "list-pull-requests",
      buildRequest(ctx: BackfillContext, cursor: unknown) {
        const repoFullName = ctx.resource.resourceName ?? "";
        const [owner = "", repo = ""] = repoFullName.split("/");
        const page = (cursor as { page: number } | null)?.page ?? 1;
        return {
          pathParams: { owner, repo },
          queryParams: {
            state: "all",
            sort: "updated",
            direction: "desc",
            per_page: "100",
            page: String(page),
          },
        };
      },
      processResponse(data: unknown, ctx: BackfillContext, cursor: unknown) {
        const repoData = buildRepoData(ctx);
        const items = z.array(githubPullRequestSchema).parse(data);
        const sinceDate = new Date(ctx.since);
        const filtered = items.filter(
          (pr) =>
            typeof pr.updated_at === "string" &&
            typeof pr.number === "number" &&
            Number.isFinite(pr.number) &&
            new Date(pr.updated_at) >= sinceDate
        );
        const events: BackfillWebhookEvent[] = filtered.map((pr) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-pr-${pr.number}`,
          eventType: "pull_request",
          payload: adaptGitHubPRForTransformer(
            pr as unknown as Record<string, unknown>,
            repoData
          ),
        }));
        const page = (cursor as { page: number } | null)?.page ?? 1;
        const hasMore =
          items.length === 100 && filtered.length === items.length;
        return {
          events,
          nextCursor: hasMore ? { page: page + 1 } : null,
          rawCount: items.length,
        };
      },
    },
    issue: {
      endpointId: "list-issues",
      buildRequest(ctx: BackfillContext, cursor: unknown) {
        const repoFullName = ctx.resource.resourceName ?? "";
        const [owner = "", repo = ""] = repoFullName.split("/");
        const page = (cursor as { page: number } | null)?.page ?? 1;
        return {
          pathParams: { owner, repo },
          queryParams: {
            state: "all",
            sort: "updated",
            direction: "desc",
            per_page: "100",
            page: String(page),
            since: ctx.since,
          },
        };
      },
      processResponse(data: unknown, ctx: BackfillContext, cursor: unknown) {
        const repoData = buildRepoData(ctx);
        const items = z.array(githubIssueSchema).parse(data);
        const issuesOnly = items.filter(
          (item) =>
            !item.pull_request &&
            typeof item.number === "number" &&
            Number.isFinite(item.number)
        );
        const events: BackfillWebhookEvent[] = issuesOnly.map((issue) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-issue-${issue.number}`,
          eventType: "issues",
          payload: adaptGitHubIssueForTransformer(
            issue as unknown as Record<string, unknown>,
            repoData
          ),
        }));
        const page = (cursor as { page: number } | null)?.page ?? 1;
        const hasMore = items.length === 100;
        return {
          events,
          nextCursor: hasMore ? { page: page + 1 } : null,
          rawCount: items.length,
        };
      },
    },
    release: {
      endpointId: "list-releases",
      buildRequest(ctx: BackfillContext, cursor: unknown) {
        const repoFullName = ctx.resource.resourceName ?? "";
        const [owner = "", repo = ""] = repoFullName.split("/");
        const page = (cursor as { page: number } | null)?.page ?? 1;
        return {
          pathParams: { owner, repo },
          queryParams: {
            per_page: "100",
            page: String(page),
          },
        };
      },
      processResponse(data: unknown, ctx: BackfillContext, cursor: unknown) {
        const repoData = buildRepoData(ctx);
        const items = z.array(githubReleaseSchema).parse(data);
        const sinceDate = new Date(ctx.since);
        const filtered = items.filter((release) => {
          if (typeof release.id !== "number" || !Number.isFinite(release.id)) {
            return false;
          }
          const publishedAt = release.published_at ?? release.created_at;
          return (
            typeof publishedAt === "string" &&
            new Date(publishedAt) >= sinceDate
          );
        });
        const events: BackfillWebhookEvent[] = filtered.map((release) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-release-${release.id}`,
          eventType: "release",
          payload: adaptGitHubReleaseForTransformer(
            release as unknown as Record<string, unknown>,
            repoData
          ),
        }));
        const page = (cursor as { page: number } | null)?.page ?? 1;
        const hasMore =
          items.length === 100 && filtered.length === items.length;
        return {
          events,
          nextCursor: hasMore ? { page: page + 1 } : null,
          rawCount: items.length,
        };
      },
    },
  },
};
