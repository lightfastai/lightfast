// Shared Task type used by hooks and components
export interface Task {
	id: string;
	description: string;
	status: "active" | "in_progress" | "completed" | "pending" | "failed";
	priority: "high" | "medium" | "low";
	createdAt?: string;
	updatedAt?: string;
	completedAt?: string;
	notes?: string;
}