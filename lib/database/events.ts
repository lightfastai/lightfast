// Event types for job tracking
export type JobEventType = "job_started" | "stage_changed" | "agent_executed" | "job_completed";

// Base event interface
interface BaseEvent {
	type: JobEventType;
	timestamp: Date;
}

// Job started event - when the workflow begins
export interface JobStartedEvent extends BaseEvent {
	type: "job_started";
	data: {
		taskDescription: string;
		constraints?: any;
	};
}

// Stage changed event - when moving between stages (analyzing, environment-setup, etc)
export interface StageChangedEvent extends BaseEvent {
	type: "stage_changed";
	data: {
		previousStage: string;
		newStage: string;
		metadata?: any;
	};
}

// Agent executed event - when an agent completes its task
export interface AgentExecutedEvent extends BaseEvent {
	type: "agent_executed";
	data: {
		agentName: string;
		toolName: string;
		input: any;
		output: any;
		success: boolean;
		duration: number;
		error?: string;
	};
}

// Job completed event - when the entire workflow finishes
export interface JobCompletedEvent extends BaseEvent {
	type: "job_completed";
	data: {
		success: boolean;
		finalOutput?: any;
		error?: string;
		duration: number;
	};
}

// Union type of all events
export type JobEvent = JobStartedEvent | StageChangedEvent | AgentExecutedEvent | JobCompletedEvent;
