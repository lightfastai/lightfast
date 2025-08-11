/**
 * Core system context - always provided by the framework
 */
export interface SystemContext {
	sessionId: string;
	resourceId: string;
}

/**
 * Request-level context - provided by HTTP handlers (fetchRequestHandler, etc.)
 */
export interface RequestContext {
	userAgent?: string;
	ipAddress?: string;
	// Can be extended with other request metadata
}

/**
 * Combined runtime context passed to tools
 * Merges system, request, and agent-specific contexts
 * @template TAgentContext - Agent-specific context defined by the user
 */
export type RuntimeContext<TAgentContext = {}> = SystemContext & RequestContext & TAgentContext;
