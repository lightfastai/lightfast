/**
 * Strongly typed logger interface for V2 Agent System
 *
 * This interface defines all loggable events and their parameters
 * to ensure type safety across the entire system.
 */

import type {
	AgentErrorParams,
	AgentLoopCompleteParams,
	AgentLoopStartParams,
	AgentStepCompleteParams,
	AgentStepStartParams,
	AgentToolCallParams,
	AgentToolResultParams,
} from "../server/events/types";

// Logger levels aligned with pino
export const LogLevel = {
	TRACE: "trace",
	DEBUG: "debug",
	INFO: "info",
	WARN: "warn",
	ERROR: "error",
	FATAL: "fatal",
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

// Import event names from the events module and extend with additional logging events
import { EventName } from "../server/events/types";

// Extended event names for comprehensive logging
export const LogEventName = {
	...EventName,
	// Additional stream events
	STREAM_START: "stream.start",
	STREAM_CHUNK: "stream.chunk",
	STREAM_COMPLETE: "stream.complete",
	STREAM_ERROR: "stream.error",
	// Message events
	MESSAGE_CREATED: "message.created",
	MESSAGE_UPDATED: "message.updated",
	MESSAGE_ERROR: "message.error",
	// Session events
	SESSION_CREATED: "session.created",
	SESSION_RESUMED: "session.resumed",
	SESSION_ERROR: "session.error",
	// Worker events
	WORKER_ENQUEUED: "worker.enqueued",
	WORKER_STARTED: "worker.started",
	WORKER_COMPLETED: "worker.completed",
	WORKER_ERROR: "worker.error",
} as const;

export type LogEventName = (typeof LogEventName)[keyof typeof LogEventName];

// Base context for all log events
interface BaseLogContext {
	sessionId: string;
	agentId: string;
	userId?: string;
	timestamp: string;
	traceId?: string;
	spanId?: string;
}

// Agent loop events - extend from parameter types
export interface AgentLoopStartContext extends BaseLogContext, AgentLoopStartParams {
	messageCount?: number;
	systemPrompt?: string;
}

export interface AgentLoopCompleteContext extends BaseLogContext, AgentLoopCompleteParams {
	tokenUsage?: {
		prompt: number;
		completion: number;
		total: number;
	};
}

export interface AgentLoopErrorContext extends BaseLogContext {
	error: Error;
	code?: string;
	input?: string;
}

// Step events - extend from parameter types
export interface AgentStepStartContext extends BaseLogContext, AgentStepStartParams {
	previousOutput?: string;
}

export interface AgentStepCompleteContext extends BaseLogContext, AgentStepCompleteParams {
	toolCallCount?: number;
	tokenUsage?: {
		prompt: number;
		completion: number;
		total: number;
	};
}

// Tool events - extend from parameter types
export interface AgentToolCallContext extends BaseLogContext, AgentToolCallParams {
	stepIndex?: number;
}

export interface AgentToolResultContext extends BaseLogContext, AgentToolResultParams {
	stepIndex?: number;
}

export interface AgentErrorContext extends BaseLogContext, AgentErrorParams {
	// All fields from AgentErrorParams
}

// Stream events
export interface StreamStartContext extends BaseLogContext {
	streamType: "delta" | "event";
	initialData?: any;
}

export interface StreamChunkContext extends BaseLogContext {
	streamType: "delta" | "event";
	chunkType: string;
	chunkSize: number;
	sequenceNumber: number;
}

export interface StreamCompleteContext extends BaseLogContext {
	streamType: "delta" | "event";
	duration: number;
	chunkCount: number;
	totalBytes: number;
}

export interface StreamErrorContext extends BaseLogContext {
	streamType: "delta" | "event";
	error: Error;
	code?: string;
}

// Message events
export interface MessageCreatedContext extends BaseLogContext {
	messageId: string;
	role: "user" | "assistant" | "system";
	content: string;
	metadata?: Record<string, any>;
}

export interface MessageUpdatedContext extends BaseLogContext {
	messageId: string;
	updates: Record<string, any>;
}

export interface MessageErrorContext extends BaseLogContext {
	messageId?: string;
	operation: "create" | "update" | "delete";
	error: Error;
	code?: string;
}

// Session events
export interface SessionCreatedContext extends BaseLogContext {
	initialMessage?: string;
	metadata?: Record<string, any>;
}

export interface SessionResumedContext extends BaseLogContext {
	messageCount: number;
	lastActivity: string;
}

export interface SessionErrorContext extends BaseLogContext {
	operation: "create" | "resume" | "save";
	error: Error;
	code?: string;
}

// Worker events
export interface WorkerEnqueuedContext extends BaseLogContext {
	workerId: string;
	workerType: string;
	payload: any;
	delay?: number;
}

export interface WorkerStartedContext extends BaseLogContext {
	workerId: string;
	workerType: string;
	attempt: number;
}

export interface WorkerCompletedContext extends BaseLogContext {
	workerId: string;
	workerType: string;
	duration: number;
	result?: any;
}

export interface WorkerErrorContext extends BaseLogContext {
	workerId: string;
	workerType: string;
	error: Error;
	code?: string;
	attempt: number;
	willRetry: boolean;
}

// Map event names to their context types
export interface LogEventContextMap {
	// Core agent events (from events module)
	[LogEventName.AGENT_LOOP_START]: AgentLoopStartContext;
	[LogEventName.AGENT_LOOP_COMPLETE]: AgentLoopCompleteContext;
	[LogEventName.AGENT_STEP_START]: AgentStepStartContext;
	[LogEventName.AGENT_STEP_COMPLETE]: AgentStepCompleteContext;
	[LogEventName.AGENT_TOOL_CALL]: AgentToolCallContext;
	[LogEventName.AGENT_TOOL_RESULT]: AgentToolResultContext;
	[LogEventName.AGENT_ERROR]: AgentErrorContext;
	// Additional logging events
	[LogEventName.STREAM_START]: StreamStartContext;
	[LogEventName.STREAM_CHUNK]: StreamChunkContext;
	[LogEventName.STREAM_COMPLETE]: StreamCompleteContext;
	[LogEventName.STREAM_ERROR]: StreamErrorContext;
	[LogEventName.MESSAGE_CREATED]: MessageCreatedContext;
	[LogEventName.MESSAGE_UPDATED]: MessageUpdatedContext;
	[LogEventName.MESSAGE_ERROR]: MessageErrorContext;
	[LogEventName.SESSION_CREATED]: SessionCreatedContext;
	[LogEventName.SESSION_RESUMED]: SessionResumedContext;
	[LogEventName.SESSION_ERROR]: SessionErrorContext;
	[LogEventName.WORKER_ENQUEUED]: WorkerEnqueuedContext;
	[LogEventName.WORKER_STARTED]: WorkerStartedContext;
	[LogEventName.WORKER_COMPLETED]: WorkerCompletedContext;
	[LogEventName.WORKER_ERROR]: WorkerErrorContext;
}

// Logger interface
export interface ILogger {
	// Core logging methods
	trace(message: string, context?: Record<string, any>): void;
	debug(message: string, context?: Record<string, any>): void;
	info(message: string, context?: Record<string, any>): void;
	warn(message: string, context?: Record<string, any>): void;
	error(message: string, error?: Error | Record<string, any>): void;
	fatal(message: string, error?: Error | Record<string, any>): void;

	// Strongly typed event logging
	logEvent<T extends keyof LogEventContextMap>(eventName: T, context: LogEventContextMap[T]): void;

	// Child logger creation
	child(bindings: Record<string, any>): ILogger;
}

// Logger factory type
export type LoggerFactory = (context: {
	sessionId: string;
	agentId: string;
	userId?: string;
	traceId?: string;
}) => ILogger;
