import type { RequestContext, SystemContext } from "./adapters/types";
import type { ApiError } from "./errors";

/**
 * Base event data that includes system and request context
 */
interface BaseLifecycleEvent {
  /** Request context including userAgent and ipAddress */
  requestContext?: RequestContext;
  /** System context including sessionId and resourceId */
  systemContext: SystemContext;
}

/**
 * Error event data for lifecycle callbacks
 */
export interface ErrorLifecycleEvent extends BaseLifecycleEvent {
  /** The error that occurred */
  error: ApiError;
}

/**
 * Stream lifecycle events
 */
export interface StreamStartEvent extends BaseLifecycleEvent {
  /** Agent name */
  agentName: string;
  /** Number of messages in the conversation */
  messageCount: number;
  /** Unique stream identifier */
  streamId: string;
}

export interface StreamCompleteEvent extends BaseLifecycleEvent {
  /** Agent name */
  agentName: string;
  /** Unique stream identifier */
  streamId: string;
}

/**
 * Agent lifecycle events
 */
export interface AgentStartEvent extends BaseLifecycleEvent {
  /** Agent name */
  agentName: string;
  /** Number of messages in the conversation */
  messageCount: number;
}

/**
 * AgentCompleteEvent extends the base lifecycle event and spreads
 * the AI SDK's onFinish callback data, plus our custom fields.
 *
 * In practice, when using streamText, additional fields are provided
 * beyond what UIMessageStreamOnFinishCallback types expose.
 */
export interface AgentCompleteEvent extends BaseLifecycleEvent {
  /** Agent name */
  agentName: string;
}

/**
 * Lifecycle callbacks for monitoring and analytics
 */
export interface LifecycleCallbacks {
  /** Called when an agent completes processing with full AI SDK data */
  onAgentComplete?: (event: AgentCompleteEvent) => void;
  /** Called when an agent starts processing */
  onAgentStart?: (event: AgentStartEvent) => void;
  /** Called when an error occurs */
  onError?: (event: ErrorLifecycleEvent) => void;
  /** Called when a stream completes */
  onStreamComplete?: (event: StreamCompleteEvent) => void;
  /** Called when a stream starts */
  onStreamStart?: (event: StreamStartEvent) => void;
}

/**
 * Helper to create lifecycle event with base data
 */
function createLifecycleEvent(
  systemContext: SystemContext,
  requestContext?: RequestContext
): BaseLifecycleEvent {
  return {
    systemContext,
    requestContext,
  };
}
