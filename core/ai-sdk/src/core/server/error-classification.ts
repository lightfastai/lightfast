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
  readonly category?: LightfastErrorCategory;
  readonly metadata?: Record<string, unknown>;
  readonly severity?: LightfastErrorSeverity;
  readonly source?: LightfastErrorSource;
}

export interface SerializedLightfastError {
  category: LightfastErrorCategory;
  error: string;
  errorCode?: string;
  message: string;
  metadata?: Record<string, unknown>;
  severity: LightfastErrorSeverity;
  source: LightfastErrorSource;
  statusCode: number;
  type: string;
}
