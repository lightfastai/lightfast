import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  verifyGitHubWebhookFromHeaders,
  extractGitHubPayloadTimestamp,
  GITHUB_MAX_WEBHOOK_AGE_SECONDS,
} from "@repo/console-webhooks/github";
import { validateWebhookTimestamp } from "@repo/console-webhooks/common";
import {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
} from "@repo/console-webhooks";
import {
  storeWebhookPayload,
  extractWebhookHeaders,
} from "@repo/console-webhooks/storage";
import { SourcesService, WorkspacesService } from "@repo/console-api-services";
import type {
  PushEvent,
  InstallationEvent,
  InstallationRepositoriesEvent,
  RepositoryEvent,
  WebhookEvent,
  PullRequestEvent,
  IssuesEvent,
  ReleaseEvent,
  DiscussionEvent,
} from "@repo/console-octokit-github";
import { inngest } from "@api/console/inngest";
import { log } from "@vendor/observability/log";
import { env } from "~/env";

export const runtime = "nodejs";

/**
 * Handle installation_repositories webhook events
 * Marks repositories as inactive when removed from installation
 */
async function handleInstallationRepositoriesEvent(
  payload: InstallationRepositoriesEvent,
) {
  if (payload.action !== "removed") {
    return;
  }

  console.log(
    `[Webhook] Repositories removed from installation ${payload.installation.id}`,
  );

  const sourcesService = new SourcesService();

  for (const repo of payload.repositories_removed) {
    await sourcesService.markInactive({
      githubRepoId: repo.id.toString(),
      reason: "Repository removed from installation",
    });

    console.log(`[Webhook] Marked repository ${repo.full_name} as inactive`);
  }
}

/**
 * Handle push webhook events
 * Triggers docs ingestion workflow via Inngest
 */
async function handlePushEvent(payload: PushEvent, deliveryId: string) {
  const branch = payload.ref.replace("refs/heads/", "");

  // Only process default branch
  if (branch !== payload.repository.default_branch) {
    console.log(`[Webhook] Ignoring push to non-default branch: ${branch}`);
    return;
  }

  // Check installation ID is present
  if (!payload.installation?.id) {
    console.error(
      `[Webhook] No installation ID in push event for ${payload.repository.full_name}`,
    );
    return;
  }

  console.log(`[Webhook] Push to ${payload.repository.full_name}:${branch}`);
  const headCommitTimestamp = payload.head_commit?.timestamp ?? undefined;
  const commitMessage = payload.head_commit?.message ?? undefined;

  // Resolve workspace and source from GitHub org slug
  const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
  if (!ownerLogin) {
    console.error(`[Webhook] Missing owner login in ${payload.repository.full_name}`);
    return;
  }

  const workspacesService = new WorkspacesService();
  const workspace = await workspacesService.resolveFromGithubOrgSlug(ownerLogin);

  const workspaceId = workspace.workspaceId;
  const workspaceKey = workspace.workspaceKey;
  console.log(
    `[Webhook] Resolved workspace: id=${workspaceId} key=${workspaceKey}`,
  );

  // Resolve sourceId (workspaceSource.id) from GitHub repository ID
  const sourcesService = new SourcesService();
  const sourceId = await sourcesService.getSourceIdByGithubRepoId(
    workspaceId,
    payload.repository.id.toString()
  );

  if (!sourceId) {
    console.error(
      `[Webhook] No workspace source found for repo ${payload.repository.full_name} in workspace ${workspaceId}`
    );
    return;
  }

  console.log(`[Webhook] Resolved sourceId: ${sourceId}`);

  // Aggregate changed files from all commits
  const changedFiles = new Map<string, "added" | "modified" | "removed">();
  for (const commit of payload.commits) {
    commit.added.forEach((path) => changedFiles.set(path, "added"));
    commit.modified.forEach((path) => changedFiles.set(path, "modified"));
    commit.removed.forEach((path) => changedFiles.set(path, "removed"));
  }

  // Convert to array for Inngest (filtering will happen in the workflow after loading config)
  const allFiles = Array.from(changedFiles.entries()).map(([path, status]) => ({
    path,
    status,
  }));

  if (allFiles.length === 0) {
    console.log(`[Webhook] No files changed`);
    return;
  }

  console.log(`[Webhook] Found ${allFiles.length} changed files`);

  // Trigger Inngest workflow (NEW: apps-console/github.push)
  await inngest.send({
    name: "apps-console/github.push",
    data: {
      workspaceId,
      workspaceKey,
      sourceId, // NEW: workspaceSource.id
      repoFullName: payload.repository.full_name,
      githubRepoId: payload.repository.id,
      githubInstallationId: payload.installation.id,
      beforeSha: payload.before,
      afterSha: payload.after, // This is the commit SHA
      commitMessage,
      branch, // NEW: branch name
      deliveryId,
      headCommitTimestamp,
      changedFiles: allFiles,
    },
  });

  console.log(
    `[Webhook] Triggered github.push workflow for ${allFiles.length} files (sourceId: ${sourceId}, workspace: ${workspaceId})`,
  );
}

/**
 * Capture push event as observation (separate from sync routing)
 * Only captures pushes to default branch
 */
async function handlePushObservation(
  payload: PushEvent,
  deliveryId: string,
  rawPayload: string,
  headers: Record<string, string>,
): Promise<void> {
  const receivedAt = new Date();

  // Only capture pushes to default branch
  const branch = payload.ref.replace("refs/heads/", "");
  if (branch !== payload.repository.default_branch) {
    return;
  }

  const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
  if (!ownerLogin) return;

  const workspacesService = new WorkspacesService();
  let workspace;
  try {
    workspace = await workspacesService.resolveFromGithubOrgSlug(ownerLogin);
  } catch {
    // Workspace not found - skip observation
    return;
  }

  // Store raw webhook payload for permanent retention
  await storeWebhookPayload({
    workspaceId: workspace.workspaceId,
    deliveryId,
    source: "github",
    eventType: "push",
    payload: rawPayload,
    headers,
    receivedAt,
  });

  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId: workspace.workspaceId,
      clerkOrgId: workspace.clerkOrgId,
      sourceEvent: transformGitHubPush(payload, {
        deliveryId,
        receivedAt,
      }),
    },
  });

  log.info("[GitHub Webhook] Push observation captured", {
    workspaceId: workspace.workspaceId,
    repo: payload.repository.full_name,
  });
}

/**
 * Handle GitHub pull request events
 */
async function handlePullRequestEvent(
  payload: PullRequestEvent,
  deliveryId: string,
  rawPayload: string,
  headers: Record<string, string>,
): Promise<void> {
  const receivedAt = new Date();

  // Only capture significant PR actions
  const significantActions = ["opened", "closed", "reopened", "ready_for_review"];
  if (!significantActions.includes(payload.action)) {
    return;
  }

  const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
  if (!ownerLogin) return;

  const workspacesService = new WorkspacesService();
  let workspace;
  try {
    workspace = await workspacesService.resolveFromGithubOrgSlug(ownerLogin);
  } catch {
    console.log(`[Webhook] No workspace for GitHub org: ${ownerLogin}`);
    return;
  }

  // Store raw webhook payload for permanent retention
  await storeWebhookPayload({
    workspaceId: workspace.workspaceId,
    deliveryId,
    source: "github",
    eventType: "pull_request",
    payload: rawPayload,
    headers,
    receivedAt,
  });

  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId: workspace.workspaceId,
      clerkOrgId: workspace.clerkOrgId,
      sourceEvent: transformGitHubPullRequest(payload, {
        deliveryId,
        receivedAt,
      }),
    },
  });

  log.info("[GitHub Webhook] PR observation captured", {
    workspaceId: workspace.workspaceId,
    action: payload.action,
    prNumber: payload.pull_request.number,
  });
}

/**
 * Handle GitHub issues events
 */
async function handleIssuesEvent(
  payload: IssuesEvent,
  deliveryId: string,
  rawPayload: string,
  headers: Record<string, string>,
): Promise<void> {
  const receivedAt = new Date();

  // Only capture significant issue actions
  const significantActions = ["opened", "closed", "reopened"];
  if (!significantActions.includes(payload.action)) {
    return;
  }

  const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
  if (!ownerLogin) return;

  const workspacesService = new WorkspacesService();
  let workspace;
  try {
    workspace = await workspacesService.resolveFromGithubOrgSlug(ownerLogin);
  } catch {
    return;
  }

  // Store raw webhook payload for permanent retention
  await storeWebhookPayload({
    workspaceId: workspace.workspaceId,
    deliveryId,
    source: "github",
    eventType: "issues",
    payload: rawPayload,
    headers,
    receivedAt,
  });

  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId: workspace.workspaceId,
      clerkOrgId: workspace.clerkOrgId,
      sourceEvent: transformGitHubIssue(payload, {
        deliveryId,
        receivedAt,
      }),
    },
  });

  log.info("[GitHub Webhook] Issue observation captured", {
    workspaceId: workspace.workspaceId,
    action: payload.action,
    issueNumber: payload.issue.number,
  });
}

/**
 * Handle GitHub release events
 */
async function handleReleaseEvent(
  payload: ReleaseEvent,
  deliveryId: string,
  rawPayload: string,
  headers: Record<string, string>,
): Promise<void> {
  const receivedAt = new Date();

  // Only capture published releases
  if (payload.action !== "published") {
    return;
  }

  const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
  if (!ownerLogin) return;

  const workspacesService = new WorkspacesService();
  let workspace;
  try {
    workspace = await workspacesService.resolveFromGithubOrgSlug(ownerLogin);
  } catch {
    return;
  }

  // Store raw webhook payload for permanent retention
  await storeWebhookPayload({
    workspaceId: workspace.workspaceId,
    deliveryId,
    source: "github",
    eventType: "release",
    payload: rawPayload,
    headers,
    receivedAt,
  });

  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId: workspace.workspaceId,
      clerkOrgId: workspace.clerkOrgId,
      sourceEvent: transformGitHubRelease(payload, {
        deliveryId,
        receivedAt,
      }),
    },
  });

  log.info("[GitHub Webhook] Release observation captured", {
    workspaceId: workspace.workspaceId,
    tagName: payload.release.tag_name,
  });
}

/**
 * Handle GitHub discussion events
 */
async function handleDiscussionEvent(
  payload: DiscussionEvent,
  deliveryId: string,
  rawPayload: string,
  headers: Record<string, string>,
): Promise<void> {
  const receivedAt = new Date();

  // Only capture created and answered discussions
  const significantActions = ["created", "answered"];
  if (!significantActions.includes(payload.action)) {
    return;
  }

  const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
  if (!ownerLogin) return;

  const workspacesService = new WorkspacesService();
  let workspace;
  try {
    workspace = await workspacesService.resolveFromGithubOrgSlug(ownerLogin);
  } catch {
    return;
  }

  // Store raw webhook payload for permanent retention
  await storeWebhookPayload({
    workspaceId: workspace.workspaceId,
    deliveryId,
    source: "github",
    eventType: "discussion",
    payload: rawPayload,
    headers,
    receivedAt,
  });

  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId: workspace.workspaceId,
      clerkOrgId: workspace.clerkOrgId,
      sourceEvent: transformGitHubDiscussion(payload, {
        deliveryId,
        receivedAt,
      }),
    },
  });

  log.info("[GitHub Webhook] Discussion observation captured", {
    workspaceId: workspace.workspaceId,
    action: payload.action,
    discussionNumber: payload.discussion.number,
  });
}

/**
 * GitHub Webhook Handler
 * POST /api/github/webhooks
 */
export async function POST(request: NextRequest) {
  try {
    // Verify signature using @repo/console-webhooks
    const payload = await request.text();
    const result = await verifyGitHubWebhookFromHeaders(
      payload,
      request.headers,
      env.GITHUB_WEBHOOK_SECRET,
    );

    if (!result.verified) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    // Parse event type
    const eventHeader = request.headers.get("x-github-event");
    if (!eventHeader) {
      return NextResponse.json(
        { error: "Missing event type" },
        { status: 400 },
      );
    }

    const event = eventHeader as WebhookEvent;
    const deliveryId = request.headers.get("x-github-delivery") ?? "unknown";
    const webhookHeaders = extractWebhookHeaders(request.headers);

    const body = JSON.parse(payload) as
      | InstallationRepositoriesEvent
      | InstallationEvent
      | RepositoryEvent
      | PushEvent
      | PullRequestEvent
      | IssuesEvent
      | ReleaseEvent
      | DiscussionEvent;

    // Timestamp validation (replay attack prevention)
    // Cast to GitHubWebhookEvent for timestamp extraction (safe - already verified)
    const payloadTimestamp = extractGitHubPayloadTimestamp(
      body as Parameters<typeof extractGitHubPayloadTimestamp>[0],
      event
    );
    if (payloadTimestamp) {
      const isTimestampValid = validateWebhookTimestamp(
        payloadTimestamp,
        GITHUB_MAX_WEBHOOK_AGE_SECONDS
      );

      if (!isTimestampValid) {
        log.warn("[GitHub Webhook] Rejected stale webhook", {
          eventType: event,
          timestamp: payloadTimestamp,
          deliveryId,
        });
        return NextResponse.json(
          { error: "Webhook timestamp too old (possible replay attack)" },
          { status: 401 }
        );
      }
    }

    // Route to appropriate handler
    switch (event) {
      case "push":
        // Handle sync workflow (existing functionality)
        await handlePushEvent(body as PushEvent, deliveryId);
        // Also capture as observation for neural memory (with raw payload storage)
        await handlePushObservation(body as PushEvent, deliveryId, payload, webhookHeaders);
        break;

      case "pull_request":
        await handlePullRequestEvent(body as PullRequestEvent, deliveryId, payload, webhookHeaders);
        break;

      case "issues":
        await handleIssuesEvent(body as IssuesEvent, deliveryId, payload, webhookHeaders);
        break;

      case "release":
        await handleReleaseEvent(body as ReleaseEvent, deliveryId, payload, webhookHeaders);
        break;

      case "discussion":
        await handleDiscussionEvent(body as DiscussionEvent, deliveryId, payload, webhookHeaders);
        break;

      case "installation_repositories":
        await handleInstallationRepositoriesEvent(
          body as InstallationRepositoriesEvent,
        );
        break;

      case "installation": {
        const installationPayload = body as InstallationEvent;
        if (installationPayload.action === "deleted") {
          console.log(
            `[Webhook] Installation ${installationPayload.installation.id} deleted`,
          );
          // Mark all repositories from this installation as inactive
          const sourcesService = new SourcesService();
          await sourcesService.markInstallationInactive(
            installationPayload.installation.id.toString(),
          );
        }
        break;
      }

      case "repository": {
        const repositoryPayload = body as RepositoryEvent;
        if (repositoryPayload.action === "deleted") {
          console.log(
            `[Webhook] Repository ${repositoryPayload.repository.id} deleted`,
          );
          // Mark repository as inactive and update metadata
          const sourcesService = new SourcesService();
          await sourcesService.markDeleted(
            repositoryPayload.repository.id.toString(),
          );
        } else if (repositoryPayload.action === "renamed") {
          console.log(
            `[Webhook] Repository renamed to ${repositoryPayload.repository.full_name}`,
          );
          // Update cached repository name
          const sourcesService = new SourcesService();
          await sourcesService.updateMetadata(
            repositoryPayload.repository.id.toString(),
            { fullName: repositoryPayload.repository.full_name },
          );
        }
        break;
      }

      default:
        // Log unhandled events but don't fail
        console.log("[Webhook] Unhandled event:", event as string);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
