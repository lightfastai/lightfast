import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { RepositoriesService } from "@repo/console-api-services";
import { db } from "@db/console/client";
import { DeusConnectedRepository, organizations, workspaces } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { getOrCreateDefaultWorkspace } from "@db/console/utils";
import { getWorkspaceKeyFromSlug } from "@api/console/lib/workspace-key";
import type {
	PushEvent,
	InstallationEvent,
	InstallationRepositoriesEvent,
	RepositoryEvent,
	WebhookEvent,
} from "@repo/console-octokit-github";
import { env } from "~/env";

export const runtime = "nodejs";

/**
 * Verify GitHub webhook signature
 * https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
function verifySignature(payload: string, signature: string): boolean {
	const hmac = createHmac("sha256", env.GITHUB_WEBHOOK_SECRET);
	const digest = `sha256=${hmac.update(payload).digest("hex")}`;

	// Prevent timing attacks with constant-time comparison
	if (signature.length !== digest.length) {
		return false;
	}

	return timingSafeEqual(
		Buffer.from(signature),
		Buffer.from(digest)
	);
}

/**
 * Handle installation_repositories webhook events
 * Marks repositories as inactive when removed from installation
 */
async function handleInstallationRepositoriesEvent(
	payload: InstallationRepositoriesEvent
) {
	if (payload.action !== "removed") {
		return;
	}

	console.log(
		`[Webhook] Repositories removed from installation ${payload.installation.id}`,
	);

	const repositoriesService = new RepositoriesService();

	for (const repo of payload.repositories_removed) {
		await repositoriesService.markInactive({
			githubRepoId: repo.id.toString(),
			githubInstallationId: payload.installation.id.toString()
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
		console.error(`[Webhook] No installation ID in push event for ${payload.repository.full_name}`);
		return;
	}

	console.log(`[Webhook] Push to ${payload.repository.full_name}:${branch}`);

    // Resolve organization -> default workspace (DB UUID) and workspaceKey from slug
    let workspaceId = "";
    let workspaceKey = "";
    try {
      const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
      if (!ownerLogin) throw new Error("Missing owner login");

      const orgRow = await db.query.organizations.findFirst({
        where: eq(organizations.githubOrgSlug, ownerLogin),
      });
      if (!orgRow) throw new Error(`Organization not found for ${ownerLogin}`);

      const wsId = await getOrCreateDefaultWorkspace(orgRow.id);
      const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, wsId) });
      if (!ws) throw new Error("Workspace row not found");

      workspaceId = ws.id; // UUID
      workspaceKey = getWorkspaceKeyFromSlug(ws.slug);
      console.log(`[Webhook] Resolved workspace: id=${workspaceId} key=${workspaceKey}`);
    } catch (error) {
      console.error(`[Webhook] Failed to resolve workspace:`, error);
      throw error; // Cannot proceed without workspace
    }

	// Aggregate changed files from all commits
	const changedFiles = new Map<string, "added" | "modified" | "removed">();
	for (const commit of payload.commits) {
		commit.added.forEach((path) => changedFiles.set(path, "added"));
		commit.modified.forEach((path) => changedFiles.set(path, "modified"));
		commit.removed.forEach((path) => changedFiles.set(path, "removed"));
	}

    // Check if lightfast.yml was modified - trigger config re-detection (update DB status eagerly)
    const configModified = Array.from(changedFiles.keys()).some((path) =>
        ["lightfast.yml", ".lightfast.yml", "lightfast.yaml", ".lightfast.yaml"].includes(path)
    );

    if (configModified) {
        try {
            const { createGitHubApp, ConfigDetectorService } = await import("@repo/console-octokit-github");
            const app = createGitHubApp({ appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY });
            const detector = new ConfigDetectorService(app);
            const [owner, repo] = payload.repository.full_name.split("/");
            const result = await detector.detectConfig(owner, repo, payload.after, payload.installation.id);

            await db
              .update(DeusConnectedRepository)
              .set({
                configStatus: result.exists ? "configured" : "unconfigured",
                configPath: result.path,
                configDetectedAt: new Date().toISOString(),
                workspaceId, // DB UUID
              })
              .where(eq(DeusConnectedRepository.githubRepoId, payload.repository.id.toString()));

            console.log(`[Webhook] Updated config status to ${result.exists ? "configured" : "unconfigured"} (${result.path ?? "none"})`);
        } catch (e) {
            console.error("[Webhook] Config re-detection failed:", e);
        }
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

	// Trigger Inngest workflow
	// Dynamic import to avoid loading Inngest in route module
	const { inngest } = await import("@api/console/inngest");

    await inngest.send({
        name: "apps-console/docs.push",
        data: {
            workspaceId, // DB UUID
            workspaceKey, // external naming key
            repoFullName: payload.repository.full_name,
            githubInstallationId: payload.installation.id,
            beforeSha: payload.before,
            afterSha: payload.after,
            deliveryId,
            changedFiles: allFiles,
        },
    });

	console.log(
		`[Webhook] Triggered ingestion workflow for ${allFiles.length} files (workspace: ${workspaceId}, installation ${payload.installation.id})`
	);
}

/**
 * GitHub Webhook Handler
 * POST /api/github/webhooks
 */
export async function POST(request: NextRequest) {
	try {
		// Verify signature
		const signature = request.headers.get("x-hub-signature-256");
		if (!signature) {
			return NextResponse.json({ error: "Missing signature" }, { status: 401 });
		}

		const payload = await request.text();
		if (!verifySignature(payload, signature)) {
			return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
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
				await handleInstallationRepositoriesEvent(body as InstallationRepositoriesEvent);
				break;

			case "installation": {
				const installationPayload = body as InstallationEvent;
				if (installationPayload.action === "deleted") {
					console.log(
						`[Webhook] Installation ${installationPayload.installation.id} deleted`,
					);
					// Mark all repositories from this installation as inactive
					const repositoriesService = new RepositoriesService();
					await repositoriesService.markInstallationInactive(
						installationPayload.installation.id.toString()
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
					const repositoriesService = new RepositoriesService();
					await repositoriesService.markDeleted(
						repositoryPayload.repository.id.toString()
					);
				} else if (repositoryPayload.action === "renamed") {
					console.log(
						`[Webhook] Repository renamed to ${repositoryPayload.repository.full_name}`,
					);
					// Update cached repository name
					const repositoriesService = new RepositoriesService();
					await repositoriesService.updateMetadata(
						repositoryPayload.repository.id.toString(),
						{ fullName: repositoryPayload.repository.full_name }
					);
				}
				break;
			}

			default:
				// TypeScript ensures all cases are handled (event type is 'never' here)
				console.log('[Webhook] Unhandled event:', event as string);
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
