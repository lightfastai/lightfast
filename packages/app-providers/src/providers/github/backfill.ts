import { z } from "zod";
import type {
  BackfillContext,
  BackfillDef,
  BackfillWebhookEvent,
} from "../../provider/backfill";
import { typedEntityHandler } from "../../provider/backfill";
import { githubIssueSchema, githubPullRequestSchema } from "./api";
import type {
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubPullRequestEvent,
} from "./schemas";

// ── Type Aliases ──────────────────────────────────────────────────────────────────

type GitHubPR = z.infer<typeof githubPullRequestSchema>;
type GitHubIssue = z.infer<typeof githubIssueSchema>;

// ── Adapter Functions ─────────────────────────────────────────────────────────────

export function adaptGitHubPRForTransformer(
  pr: GitHubPR,
  ctx: BackfillContext
): PreTransformGitHubPullRequestEvent {
  const action = pr.state === "open" ? "opened" : "closed";
  // List API may omit `merged` or return null — derive from merged_at instead
  const merged = pr.merged ?? pr.merged_at != null;
  const repoData = buildRepoData(ctx);
  // githubUserSchema has avatar_url optional; ghUserSchema requires it — normalise here
  const user = pr.user
    ? {
        login: pr.user.login,
        id: pr.user.id,
        avatar_url: pr.user.avatar_url ?? "",
      }
    : null;
  return {
    action,
    number: pr.number,
    pull_request: {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body,
      html_url: pr.html_url,
      user,
      head: { ref: pr.head.ref, sha: pr.head.sha },
      base: { ref: pr.base.ref, sha: pr.base.sha },
      state: pr.state,
      merged,
      merge_commit_sha: pr.merge_commit_sha,
      draft: pr.draft,
      // List API omits these — default to 0
      additions: pr.additions ?? 0,
      deletions: pr.deletions ?? 0,
      changed_files: pr.changed_files ?? 0,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
    },
    repository: repoData,
    sender: user ?? { login: "unknown", id: 0, avatar_url: "" },
  };
}

export function adaptGitHubIssueForTransformer(
  issue: GitHubIssue,
  ctx: BackfillContext
): PreTransformGitHubIssuesEvent {
  const action = issue.state === "open" ? "opened" : "closed";
  const repoData = buildRepoData(ctx);
  // githubUserSchema has avatar_url optional; ghUserSchema requires it — normalise here
  const user = issue.user
    ? {
        login: issue.user.login,
        id: issue.user.id,
        avatar_url: issue.user.avatar_url ?? "",
      }
    : null;
  return {
    action,
    issue: {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      html_url: issue.html_url,
      user,
      state: issue.state,
      state_reason: issue.state_reason,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      closed_at: issue.closed_at,
    },
    repository: repoData,
    sender: user ?? { login: "unknown", id: 0, avatar_url: "" },
  };
}

// ── Helper ────────────────────────────────────────────────────────────────────────

function buildRepoData(ctx: BackfillContext) {
  const repoFullName = ctx.resource.resourceName;
  const repoId = Number(ctx.resource.providerResourceId);
  const [owner = "", name = ""] = repoFullName.split("/");
  return {
    id: repoId,
    name,
    full_name: repoFullName,
    html_url: `https://github.com/${repoFullName}`,
    private: false,
    owner: { login: owner },
    default_branch: "main",
  };
}

// ── Backfill Definition ───────────────────────────────────────────────────────────

export const githubBackfill: BackfillDef = {
  supportedEntityTypes: ["pull_request", "issue"],
  defaultEntityTypes: ["pull_request", "issue"],
  entityTypes: {
    pull_request: typedEntityHandler<{ page: number }>({
      endpointId: "list-pull-requests",
      buildRequest(ctx: BackfillContext, cursor: { page: number } | null) {
        const repoFullName = ctx.resource.resourceName;
        const [owner = "", repo = ""] = repoFullName.split("/");
        const page = cursor?.page ?? 1;
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
      processResponse(
        data: unknown,
        ctx: BackfillContext,
        cursor: { page: number } | null
      ) {
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
          payload: adaptGitHubPRForTransformer(pr, ctx),
        }));
        const page = cursor?.page ?? 1;
        const hasMore =
          items.length === 100 && filtered.length === items.length;
        return {
          events,
          nextCursor: hasMore ? { page: page + 1 } : null,
          rawCount: items.length,
        };
      },
    }),
    issue: typedEntityHandler<{ page: number }>({
      endpointId: "list-issues",
      buildRequest(ctx: BackfillContext, cursor: { page: number } | null) {
        const repoFullName = ctx.resource.resourceName;
        const [owner = "", repo = ""] = repoFullName.split("/");
        const page = cursor?.page ?? 1;
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
      processResponse(
        data: unknown,
        ctx: BackfillContext,
        cursor: { page: number } | null
      ) {
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
          payload: adaptGitHubIssueForTransformer(issue, ctx),
        }));
        const page = cursor?.page ?? 1;
        const hasMore = items.length === 100;
        return {
          events,
          nextCursor: hasMore ? { page: page + 1 } : null,
          rawCount: items.length,
        };
      },
    }),
  },
};
