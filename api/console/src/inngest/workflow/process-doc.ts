/**
 * Batched document processing workflow
 *
 * Uses Inngest batch events to collect multiple file updates per store,
 * chunk + embed them together, and perform a single Pinecone upsert.
 */

import { inngest } from "../client/client";
import { log } from "@vendor/observability/log";
import { PRIVATE_CONFIG } from "@repo/console-config";
import {
	processDocumentsBatch,
	type ProcessDocEvent,
} from "./lib/document-processing";

export const processDoc = inngest.createFunction(
	{
		id: "apps-console/process-doc",
		name: "Process Documents",
		description:
			"Processes repo documents in batches: fetch, parse, chunk, embed, upsert",
		retries: 3,

		// Prevent reprocessing same file at same commit
		idempotency:
			'event.data.storeSlug + "-" + event.data.filePath + "-" + event.data.commitSha',

		// Batch events per workspace + store to align with Pinecone index layout
			batchEvents: {
				maxSize: PRIVATE_CONFIG.workflow.processDoc.batchSize,
				timeout: PRIVATE_CONFIG.workflow.processDoc.batchTimeout,
				key: 'event.data.workspaceId + "-" + event.data.storeSlug',
			},

		// Limit per-store processing to avoid noisy neighbors
			concurrency: [
				{
					key: 'event.data.workspaceId + "-" + event.data.storeSlug',
					limit: PRIVATE_CONFIG.workflow.processDoc.perStoreConcurrency,
				},
			],

		// Timeout for large batches
		timeouts: {
			start: "1m",
			finish: "15m",
		},
	},
	{ event: "apps-console/docs.file.process" },
	async ({ events, step }) => {
		if (!events.length) {
			return { processed: 0, skipped: 0, results: [] };
		}

			const sample = events[0];
			log.info("Processing document batch", {
				storeSlug: sample.data.storeSlug,
				workspaceId: sample.data.workspaceId,
				count: events.length,
			});

			const payloads: ProcessDocEvent[] = events.map((evt) => ({
				workspaceId: evt.data.workspaceId,
				storeSlug: evt.data.storeSlug,
				repoFullName: evt.data.repoFullName,
				filePath: evt.data.filePath,
				commitSha: evt.data.commitSha,
				committedAt: evt.data.committedAt,
				githubInstallationId: evt.data.githubInstallationId,
			}));

		const results = await step.run("process-documents", () =>
			processDocumentsBatch(payloads),
		);

		const processed = results.filter((result) => result.status === "processed");
		const skipped = results.filter((result) => result.status === "skipped");

		log.info("Completed document batch", {
			processed: processed.length,
			skipped: skipped.length,
		});

		return {
			processed: processed.length,
			skipped: skipped.length,
			results,
		};
	},
);
