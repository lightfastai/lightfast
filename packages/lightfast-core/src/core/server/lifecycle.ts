import type { 
  UIMessage, 
  LanguageModelUsage,
  FinishReason,
  CallWarning,
  GeneratedFile,
  LanguageModelRequestMetadata,
  LanguageModelResponseMetadata
} from "ai";
import type { ApiError } from "./errors";
import type { SystemContext, RequestContext } from "./adapters/types";

/**
 * Base event data that includes system and request context
 */
export interface BaseLifecycleEvent {
  /** System context including sessionId and resourceId */
  systemContext: SystemContext;
  /** Request context including userAgent and ipAddress */
  requestContext?: RequestContext;
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
  /** Unique stream identifier */
  streamId: string;
  /** Agent name */
  agentName: string;
  /** Number of messages in the conversation */
  messageCount: number;
}

export interface StreamCompleteEvent extends BaseLifecycleEvent {
  /** Unique stream identifier */
  streamId: string;
  /** Agent name */
  agentName: string;
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
 * The base type from UIMessageStreamOnFinishCallback
 */
type UIMessageStreamOnFinishEvent<UI_MESSAGE extends UIMessage = UIMessage> = {
  /** The updated list of messages */
  messages: UI_MESSAGE[];
  /** Whether the response is a continuation */
  isContinuation: boolean;
  /** Whether the stream was aborted */
  isAborted: boolean;
  /** The response message that was generated */
  responseMessage: UI_MESSAGE;
};

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
  /** Called when an error occurs */
  onError?: (event: ErrorLifecycleEvent) => void;
  /** Called when a stream starts */
  onStreamStart?: (event: StreamStartEvent) => void;
  /** Called when a stream completes */
  onStreamComplete?: (event: StreamCompleteEvent) => void;
  /** Called when an agent starts processing */
  onAgentStart?: (event: AgentStartEvent) => void;
  /** Called when an agent completes processing with full AI SDK data */
  onAgentComplete?: (event: AgentCompleteEvent) => void;
}

/**
 * Helper to create lifecycle event with base data
 */
export function createLifecycleEvent(
  systemContext: SystemContext,
  requestContext?: RequestContext
): BaseLifecycleEvent {
  return {
    systemContext,
    requestContext,
  };
}