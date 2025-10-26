import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { RepositoriesService, CodeReviewsService } from "@repo/deus-api-services";
import { env } from "~/env";

export const runtime = "nodejs";

/**
 * GitHub Webhook Event Types
 * https://docs.github.com/en/webhooks/webhook-events-and-payloads
 */
type GitHubWebhookEvent =
	| "pull_request"
	| "pull_request.opened"
	| "pull_request.edited"
	| "pull_request.closed"
	| "pull_request.reopened"
	| "pull_request.synchronize"
	| "installation"
	| "installation.deleted"
	| "installation_repositories"
	| "installation_repositories.removed"
	| "repository"
	| "repository.deleted"
	| "repository.renamed";

/**
 * Pull Request Event Payload
 */
interface PullRequestPayload {
	action: "opened" | "edited" | "closed" | "reopened" | "synchronize";
	pull_request: {
		id: number;
		number: number;
		title: string;
		state: "open" | "closed";
		merged: boolean;
		user: {
			login: string;
			avatar_url: string;
		};
		html_url: string;
		head: {
			ref: string;
		};
	};
	repository: {
		id: number;
		full_name: string;
	};
	installation?: {
		id: number;
	};
}

/**
 * Installation Event Payload
 */
interface InstallationPayload {
	action:
		| "created"
		| "deleted"
		| "suspend"
		| "unsuspend"
		| "new_permissions_accepted";
	installation: {
		id: number;
	};
}

/**
 * Repository Event Payload
 */
interface RepositoryPayload {
	action:
		| "created"
		| "deleted"
		| "archived"
		| "unarchived"
		| "edited"
		| "renamed"
		| "transferred"
		| "publicized"
		| "privatized";
	repository: {
		id: number;
		full_name: string;
	};
}

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
 * Handle pull_request webhook events
 * Updates cached PR metadata in code reviews
 */
async function handlePullRequestEvent(payload: PullRequestPayload) {
	const { action, pull_request, repository } = payload;

	console.log(
		`[Webhook] PR ${action}: ${repository.full_name}#${pull_request.number}`,
	);

	const repositoriesService = new RepositoriesService();
	const codeReviewsService = new CodeReviewsService();

	// Find the connected repository
	const repo = await repositoriesService.findActiveByGithubRepoId(
		repository.id.toString()
	);

	if (!repo) {
		console.log(
			`[Webhook] Repository ${repository.id} not connected, skipping`,
		);
		return;
	}

	const repositoryId = repo.id;

	// Find all reviews for this PR
	const reviews = await codeReviewsService.findByRepositoryAndPrId(
		repositoryId,
		pull_request.id.toString()
	);

	if (reviews.length === 0) {
		console.log(`[Webhook] No reviews found for PR ${pull_request.id}`);
		return;
	}

	console.log(
		`[Webhook] Updating ${reviews.length} review(s) for PR ${pull_request.id}`,
	);

	// Update metadata for all reviews of this PR
	const updatedReviews = reviews.map((review) => ({
		id: review.id,
		metadata: {
			...(review.metadata as Record<string, unknown>),
			prTitle: pull_request.title,
			prState: pull_request.state,
			prMerged: pull_request.merged,
			prAuthor: pull_request.user.login,
			prAuthorAvatar: pull_request.user.avatar_url,
			prUrl: pull_request.html_url,
			branch: pull_request.head.ref,
			lastSyncedAt: new Date().toISOString(),
		},
	}));

	await codeReviewsService.updateMetadataBatch(updatedReviews);

	console.log(
		`[Webhook] Successfully updated metadata for PR ${pull_request.id}`,
	);
}

/**
 * Installation Repositories Event Payload
 */
interface InstallationRepositoriesPayload {
	action: "added" | "removed";
	repositories_removed?: { id: number; full_name: string }[];
	installation: { id: number };
}

/**
 * Handle installation_repositories webhook events
 * Marks repositories as inactive when removed from installation
 */
async function handleInstallationRepositoriesEvent(
	payload: InstallationRepositoriesPayload
) {
	if (payload.action !== "removed" || !payload.repositories_removed) {
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

		const event = eventHeader as GitHubWebhookEvent;

		const body = JSON.parse(payload) as
			| PullRequestPayload
			| InstallationRepositoriesPayload
			| InstallationPayload
			| RepositoryPayload;

		// Route to appropriate handler
		switch (event) {
			case "pull_request":
				await handlePullRequestEvent(body as PullRequestPayload);
				break;

			case "installation_repositories":
				await handleInstallationRepositoriesEvent(body as InstallationRepositoriesPayload);
				break;

			case "installation": {
				const installationPayload = body as InstallationPayload;
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
				const repositoryPayload = body as RepositoryPayload;
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
				console.log(`[Webhook] Unhandled event: ${event}`);
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
