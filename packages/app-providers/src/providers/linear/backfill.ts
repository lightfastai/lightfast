import { z } from "zod";
import type { BackfillContext, BackfillDef } from "../../provider/backfill";
import { typedEntityHandler } from "../../provider/backfill";
import type {
  PreTransformLinearCommentWebhook,
  PreTransformLinearIssueWebhook,
  PreTransformLinearProjectWebhook,
} from "./schemas";

// ── Shared schemas ────────────────────────────────────────────────────────────

const pageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable(),
});

// ── Issue query response schema ───────────────────────────────────────────────

const linearIssueNodeSchema = z
  .object({
    id: z.string(),
    identifier: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    priority: z.number(),
    url: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    state: z
      .object({
        id: z.string(),
        name: z.string(),
        type: z
          .enum(["backlog", "unstarted", "started", "completed", "canceled"])
          .catch("backlog"),
      })
      .loose(),
    assignee: z
      .object({
        id: z.string(),
        name: z.string(),
        email: z.string().optional(),
      })
      .loose()
      .nullable()
      .optional(),
    team: z
      .object({
        id: z.string(),
        key: z.string(),
        name: z.string(),
      })
      .loose(),
    project: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .loose()
      .nullable()
      .optional(),
    labels: z
      .object({
        nodes: z.array(z.object({ id: z.string(), name: z.string() }).loose()),
      })
      .optional(),
  })
  .loose();

export type LinearIssueNode = z.infer<typeof linearIssueNodeSchema>;

const issuesQueryResponseSchema = z.object({
  data: z.object({
    issues: z.object({
      nodes: z.array(linearIssueNodeSchema),
      pageInfo: pageInfoSchema,
    }),
  }),
});

// ── Comment query response schema ─────────────────────────────────────────────

const linearCommentNodeSchema = z
  .object({
    id: z.string(),
    body: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    user: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .loose()
      .nullable()
      .optional(),
    issue: z
      .object({
        id: z.string(),
        identifier: z.string(),
        title: z.string(),
      })
      .loose(),
  })
  .loose();

export type LinearCommentNode = z.infer<typeof linearCommentNodeSchema>;

const commentsQueryResponseSchema = z.object({
  data: z.object({
    comments: z.object({
      nodes: z.array(linearCommentNodeSchema),
      pageInfo: pageInfoSchema,
    }),
  }),
});

// ── Project query response schema ─────────────────────────────────────────────

const linearProjectNodeSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    state: z
      .enum([
        "backlog",
        "planned",
        "started",
        "paused",
        "completed",
        "canceled",
      ])
      .catch("backlog"),
    url: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    lead: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .loose()
      .nullable()
      .optional(),
    startDate: z.string().nullable().optional(),
    targetDate: z.string().nullable().optional(),
  })
  .loose();

export type LinearProjectNode = z.infer<typeof linearProjectNodeSchema>;

const projectsQueryResponseSchema = z.object({
  data: z.object({
    projects: z.object({
      nodes: z.array(linearProjectNodeSchema),
      pageInfo: pageInfoSchema,
    }),
  }),
});

// ── GraphQL Queries ───────────────────────────────────────────────────────────

const LINEAR_ISSUES_QUERY = `
  query BackfillIssues($teamId: ID!, $after: String, $since: DateTime!) {
    issues(
      first: 50
      after: $after
      orderBy: updatedAt
      includeArchived: true
      filter: {
        team: { id: { eq: $teamId } }
        updatedAt: { gt: $since }
      }
    ) {
      nodes {
        id identifier title description priority url createdAt updatedAt
        state { id name type }
        assignee { id name email }
        team { id key name }
        project { id name }
        labels { nodes { id name } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const LINEAR_COMMENTS_QUERY = `
  query BackfillComments($teamId: ID!, $after: String, $since: DateTime!) {
    comments(
      first: 50
      after: $after
      orderBy: updatedAt
      filter: {
        issue: { team: { id: { eq: $teamId } } }
        updatedAt: { gt: $since }
      }
    ) {
      nodes {
        id body createdAt updatedAt
        user { id name }
        issue { id identifier title }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const LINEAR_PROJECTS_QUERY = `
  query BackfillProjects($teamId: ID!, $after: String, $since: DateTime!) {
    projects(
      first: 50
      after: $after
      orderBy: updatedAt
      filter: {
        teams: { some: { id: { eq: $teamId } } }
        updatedAt: { gt: $since }
      }
    ) {
      nodes {
        id name description state url createdAt updatedAt
        lead { id name }
        startDate targetDate
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

// ── Priority label helper ─────────────────────────────────────────────────────

function linearPriorityLabel(priority: number): string {
  const labels: Record<number, string> = {
    0: "No priority",
    1: "Urgent",
    2: "High",
    3: "Medium",
    4: "Low",
  };
  return labels[priority] ?? "No priority";
}

// ── Adapter functions ─────────────────────────────────────────────────────────

export function adaptLinearIssueForTransformer(
  issue: LinearIssueNode,
  ctx: BackfillContext
): PreTransformLinearIssueWebhook {
  return {
    action: "create",
    createdAt: issue.updatedAt,
    organizationId: ctx.installationId,
    webhookId: "",
    webhookTimestamp: Date.now(),
    type: "Issue",
    data: {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? undefined,
      priority: issue.priority,
      priorityLabel: linearPriorityLabel(issue.priority),
      boardOrder: 0,
      sortOrder: 0,
      number: 0,
      url: issue.url,
      branchName: "",
      customerTicketCount: 0,
      previousIdentifiers: [],
      subscriberIds: [],
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      state: {
        id: issue.state.id,
        name: issue.state.name,
        color: "",
        type: issue.state.type,
      },
      assignee: issue.assignee
        ? {
            id: issue.assignee.id,
            name: issue.assignee.name,
            email: issue.assignee.email,
          }
        : undefined,
      team: {
        id: issue.team.id,
        key: issue.team.key,
        name: issue.team.name,
      },
      project: issue.project
        ? {
            id: issue.project.id,
            name: issue.project.name,
            url: "",
          }
        : undefined,
      labels: (issue.labels?.nodes ?? []).map((label) => ({
        id: label.id,
        name: label.name,
        color: "",
      })),
    },
  } satisfies PreTransformLinearIssueWebhook;
}

export function adaptLinearCommentForTransformer(
  comment: LinearCommentNode,
  ctx: BackfillContext
): PreTransformLinearCommentWebhook {
  return {
    action: "create",
    createdAt: comment.updatedAt,
    organizationId: ctx.installationId,
    webhookId: "",
    webhookTimestamp: Date.now(),
    type: "Comment",
    data: {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      url: "",
      reactionData: [],
      user: comment.user
        ? { id: comment.user.id, name: comment.user.name }
        : { id: "unknown", name: "Unknown" },
      issue: {
        id: comment.issue.id,
        identifier: comment.issue.identifier,
        title: comment.issue.title,
        url: "",
      },
    },
  } satisfies PreTransformLinearCommentWebhook;
}

export function adaptLinearProjectForTransformer(
  project: LinearProjectNode,
  ctx: BackfillContext
): PreTransformLinearProjectWebhook {
  const teamId = ctx.resource.providerResourceId;
  const teamName = ctx.resource.resourceName;
  return {
    action: "create",
    createdAt: project.updatedAt,
    organizationId: ctx.installationId,
    webhookId: "",
    webhookTimestamp: Date.now(),
    type: "Project",
    data: {
      id: project.id,
      name: project.name,
      description: project.description ?? undefined,
      state: project.state,
      color: "",
      url: project.url,
      slugId: project.id,
      sortOrder: 0,
      progress: 0,
      scope: 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      targetDate: project.targetDate ?? undefined,
      startDate: project.startDate ?? undefined,
      slackNewIssue: false,
      slackIssueComments: false,
      slackIssueStatuses: false,
      lead: project.lead
        ? { id: project.lead.id, name: project.lead.name }
        : undefined,
      members: [],
      teams: [{ id: teamId, key: "", name: teamName }],
    },
  } satisfies PreTransformLinearProjectWebhook;
}

// ── Backfill Definition ───────────────────────────────────────────────────────

export const linearBackfill: BackfillDef = {
  supportedEntityTypes: ["Issue", "Comment", "Project"],
  defaultEntityTypes: ["Issue", "Comment", "Project"],
  entityTypes: {
    Issue: typedEntityHandler<string>({
      endpointId: "graphql",
      buildRequest(ctx: BackfillContext, cursor: string | null) {
        return {
          body: {
            query: LINEAR_ISSUES_QUERY,
            variables: {
              teamId: ctx.resource.providerResourceId,
              after: cursor ?? undefined,
              since: ctx.since,
            },
          },
        };
      },
      processResponse(
        data: unknown,
        ctx: BackfillContext,
        _cursor: string | null
      ) {
        const parsed = issuesQueryResponseSchema.parse(data);
        const issues = parsed.data.issues;
        const events = issues.nodes.map((issue) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-issue-${issue.id}`,
          eventType: "Issue",
          payload: adaptLinearIssueForTransformer(issue, ctx),
        }));
        return {
          events,
          nextCursor: issues.pageInfo.hasNextPage
            ? issues.pageInfo.endCursor
            : null,
          rawCount: issues.nodes.length,
        };
      },
    }),
    Comment: typedEntityHandler<string>({
      endpointId: "graphql",
      buildRequest(ctx: BackfillContext, cursor: string | null) {
        return {
          body: {
            query: LINEAR_COMMENTS_QUERY,
            variables: {
              teamId: ctx.resource.providerResourceId,
              after: cursor ?? undefined,
              since: ctx.since,
            },
          },
        };
      },
      processResponse(
        data: unknown,
        ctx: BackfillContext,
        _cursor: string | null
      ) {
        const parsed = commentsQueryResponseSchema.parse(data);
        const comments = parsed.data.comments;
        const events = comments.nodes.map((comment) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-comment-${comment.id}`,
          eventType: "Comment",
          payload: adaptLinearCommentForTransformer(comment, ctx),
        }));
        return {
          events,
          nextCursor: comments.pageInfo.hasNextPage
            ? comments.pageInfo.endCursor
            : null,
          rawCount: comments.nodes.length,
        };
      },
    }),
    Project: typedEntityHandler<string>({
      endpointId: "graphql",
      buildRequest(ctx: BackfillContext, cursor: string | null) {
        return {
          body: {
            query: LINEAR_PROJECTS_QUERY,
            variables: {
              teamId: ctx.resource.providerResourceId,
              after: cursor ?? undefined,
              since: ctx.since,
            },
          },
        };
      },
      processResponse(
        data: unknown,
        ctx: BackfillContext,
        _cursor: string | null
      ) {
        const parsed = projectsQueryResponseSchema.parse(data);
        const projects = parsed.data.projects;
        const events = projects.nodes.map((project) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-project-${project.id}`,
          eventType: "Project",
          payload: adaptLinearProjectForTransformer(project, ctx),
        }));
        return {
          events,
          nextCursor: projects.pageInfo.hasNextPage
            ? projects.pageInfo.endCursor
            : null,
          rawCount: projects.nodes.length,
        };
      },
    }),
  },
};
