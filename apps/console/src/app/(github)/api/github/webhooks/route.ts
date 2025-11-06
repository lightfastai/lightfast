import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { RepositoriesService } from "@repo/console-api-services";
import { env } from "~/env";

export const runtime = "nodejs";

/**
 * GitHub Webhook Event Types
 * https://docs.github.com/en/webhooks/webhook-events-and-payloads
 */
type GitHubWebhookEvent =
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

// pull_request events are ignored since code reviews were removed

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
