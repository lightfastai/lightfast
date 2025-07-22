import { del, list, put } from "@vercel/blob";

export interface StreamRecord {
	streamId: string;
	agentId: string;
	threadId: string;
	userId: string;
	createdAt: Date;
}

/**
 * Store a stream ID for a specific thread
 */
export async function createStreamId({
	streamId,
	agentId,
	threadId,
	userId,
}: {
	streamId: string;
	agentId: string;
	threadId: string;
	userId: string;
}) {
	const streamRecord: StreamRecord = {
		streamId,
		agentId,
		threadId,
		userId,
		createdAt: new Date(),
	};

	// Store in Vercel Blob with a specific path pattern
	const blobPath = `streams/${userId}/${threadId}/${streamId}.json`;
	await put(blobPath, JSON.stringify(streamRecord), {
		access: "public",
		contentType: "application/json",
	});

	return streamRecord;
}

/**
 * Get all stream IDs for a specific thread
 */
export async function getStreamIdsByThreadId({
	threadId,
	userId,
}: {
	threadId: string;
	userId: string;
}): Promise<StreamRecord[]> {
	try {
		// List all blobs in the thread's stream directory
		const { blobs } = await list({
			prefix: `streams/${userId}/${threadId}/`,
		});

		// Sort by creation time (most recent first)
		const sortedBlobs = blobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

		// Fetch and parse each stream record
		const streamRecords = await Promise.all(
			sortedBlobs.map(async (blob) => {
				const response = await fetch(blob.downloadUrl);
				const record = await response.json();
				return record as StreamRecord;
			}),
		);

		return streamRecords;
	} catch (error) {
		return [];
	}
}

/**
 * Get the most recent stream ID for a thread
 */
export async function getMostRecentStreamId({
	threadId,
	userId,
}: {
	threadId: string;
	userId: string;
}): Promise<StreamRecord | null> {
	const streamRecords = await getStreamIdsByThreadId({ threadId, userId });
	return streamRecords[0] || null;
}

/**
 * Clean up old stream IDs (optional, for maintenance)
 */
export async function cleanupOldStreamIds({
	threadId,
	userId,
	keepCount = 5,
}: {
	threadId: string;
	userId: string;
	keepCount?: number;
}) {
	const streamRecords = await getStreamIdsByThreadId({ threadId, userId });

	// Keep only the most recent N stream IDs
	const recordsToDelete = streamRecords.slice(keepCount);

	await Promise.all(
		recordsToDelete.map(async (record) => {
			const blobPath = `streams/${userId}/${threadId}/${record.streamId}.json`;
			await del(blobPath);
		}),
	);
}
