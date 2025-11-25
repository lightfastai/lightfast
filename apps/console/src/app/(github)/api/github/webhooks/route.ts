import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyGitHubWebhookFromHeaders } from "@repo/console-webhooks/github";
import { SourcesService, WorkspacesService } from "@repo/console-api-services";
import type {
  PushEvent,
  InstallationEvent,
  InstallationRepositoriesEvent,
  RepositoryEvent,
  WebhookEvent,
} from "@repo/console-octokit-github";
import { inngest } from "@api/console/inngest";
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
      afterSha: payload.after,
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

    const body = JSON.parse(payload) as
      | InstallationRepositoriesEvent
      | InstallationEvent
      | RepositoryEvent
      | PushEvent;

    // Route to appropriate handler
    switch (event) {
      case "push":
        await handlePushEvent(body as PushEvent, deliveryId);
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
        // TypeScript ensures all cases are handled (event type is 'never' here)
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
