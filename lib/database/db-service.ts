import { eq } from "drizzle-orm";
import { db } from "./client";
import type { JobEvent } from "./events";
import { jobs, type NewJob, threads } from "./schema";

type ThreadMetadata = Record<string, unknown>;

export class DbService {
	// Thread operations
	async createThread(id: string, metadata?: ThreadMetadata): Promise<string> {
		await db.insert(threads).values({
			id,
			metadata,
		});
		return id;
	}

	async updateThreadStatus(threadId: string, status: "active" | "completed" | "error") {
		await db.update(threads).set({ status }).where(eq(threads.id, threadId));
	}

	// Job operations
	async createJob(threadId: string, taskDescription: string): Promise<string> {
		const jobId = `job_${threadId}_${Date.now()}`;

		// Create job with initial event
		const initialEvent: JobEvent = {
			type: "job_started",
			timestamp: new Date(),
			data: {
				taskDescription,
			},
		};

		await db.insert(jobs).values({
			id: jobId,
			threadId,
			taskDescription,
			status: "pending",
			events: [initialEvent],
		});

		return jobId;
	}

	async addJobEvent(jobId: string, event: Omit<JobEvent, "timestamp">) {
		// Get current job
		const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);

		if (!job) {
			throw new Error("Job not found");
		}

		// Add timestamp to event
		const eventWithTimestamp: JobEvent = {
			...event,
			timestamp: new Date(),
		} as JobEvent;

		// Update events array
		const updatedEvents = [...(job.events || []), eventWithTimestamp];

		// Update job status based on event type
		let newStatus = job.status;
		if (event.type === "job_started") {
			newStatus = "running";
		} else if (event.type === "job_completed" && "success" in event.data) {
			newStatus = event.data.success ? "completed" : "failed";
		}

		// Update job
		const updateData: Partial<NewJob> = {
			events: updatedEvents,
			status: newStatus,
		};

		if (event.type === "job_started" && !job.startedAt) {
			updateData.startedAt = new Date();
		}

		if (event.type === "job_completed") {
			updateData.completedAt = new Date();
			if ("error" in event.data && event.data.error) {
				updateData.error = event.data.error;
			}
			if ("finalOutput" in event.data && event.data.finalOutput) {
				updateData.result = event.data.finalOutput;
			}
		}

		await db.update(jobs).set(updateData).where(eq(jobs.id, jobId));
	}

	// Query operations
	async getThreadWithJobs(threadId: string) {
		const [thread] = await db.select().from(threads).where(eq(threads.id, threadId)).limit(1);

		if (!thread) {
			return null;
		}

		const threadJobs = await db.select().from(jobs).where(eq(jobs.threadId, threadId)).orderBy(jobs.createdAt);

		return {
			thread,
			jobs: threadJobs,
		};
	}

	async getJob(jobId: string) {
		const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);

		return job;
	}
}

// Export singleton instance
export const dbService = new DbService();
