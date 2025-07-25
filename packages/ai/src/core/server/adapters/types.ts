/**
 * System-defined runtime context that is always provided by the framework
 */
export interface SystemRuntimeContext {
	threadId: string;
	resourceId: string;
}

/**
 * Combined runtime context type that includes both system and user-defined contexts
 * @template TUserContext - User-defined additional context fields
 */
export type RuntimeContext<TUserContext = {}> = SystemRuntimeContext & TUserContext;
