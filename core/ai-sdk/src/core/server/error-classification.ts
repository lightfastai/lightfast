export enum LightfastErrorSource {
	LightfastCore = "lightfast-core",
	AiSdk = "ai-sdk",
	Guard = "guard",
	Memory = "memory",
	External = "external",
}

export enum LightfastErrorCategory {
	Stream = "stream",
	Persistence = "persistence",
	Resume = "resume",
	Request = "request",
	Authentication = "authentication",
	Authorization = "authorization",
	RateLimit = "rate-limit",
	Model = "model",
	Tool = "tool",
	Validation = "validation",
	Infrastructure = "infrastructure",
	Cache = "cache",
	Unknown = "unknown",
}

export enum LightfastErrorSeverity {
	Fatal = "fatal",
	Recoverable = "recoverable",
	Transient = "transient",
}

export interface LightfastErrorContext {
	readonly source?: LightfastErrorSource;
	readonly category?: LightfastErrorCategory;
	readonly severity?: LightfastErrorSeverity;
	readonly metadata?: Record<string, unknown>;
}

export interface SerializedLightfastError {
	type: string;
	error: string;
	message: string;
	statusCode: number;
	errorCode?: string;
	source: LightfastErrorSource;
	category: LightfastErrorCategory;
	severity: LightfastErrorSeverity;
	metadata?: Record<string, unknown>;
}
