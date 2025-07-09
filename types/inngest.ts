// Types for Inngest events and function payloads

// Update event for SSE
export interface UpdateEvent {
	name: "updates/send";
	data: {
		chatId: string;
		message: string;
		type: "info" | "success" | "error" | "result";
		metadata?: Record<string, unknown>;
	};
}

// Task execution event
export interface TaskExecuteEvent {
	name: "task/execute";
	data: {
		taskDescription: string;
		chatId: string;
		constraints?: {
			maxExecutionTime?: number;
			allowedDependencies?: string[];
			blockedDependencies?: string[];
			memoryLimit?: string;
		};
	};
}

export type InngestEvents = UpdateEvent | TaskExecuteEvent;

// Response types

// API response types
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	eventId?: string;
	message?: string;
}
