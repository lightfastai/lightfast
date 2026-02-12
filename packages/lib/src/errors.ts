/**
 * Options for creating a domain error base class
 */
export interface DomainErrorOptions {
  /** Error code string (e.g., "UNAUTHORIZED", "RATE_LIMITED") */
  code: string;
  /** Human-readable error message */
  message: string;
  /** HTTP status code if applicable */
  status?: number;
  /** Request ID for tracing */
  requestId?: string;
  /** Original error cause */
  cause?: unknown;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Base class for domain-specific errors.
 * Provides consistent field naming across the codebase:
 * - `code`: string error code
 * - `status`: HTTP status code (optional)
 * - `requestId`: trace ID (optional)
 * - `cause`: original error (optional)
 * - `metadata`: additional context (optional)
 */
export class DomainError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly requestId?: string;
  override readonly cause?: unknown;
  readonly metadata?: Record<string, unknown>;

  constructor(options: DomainErrorOptions) {
    super(options.message);
    this.name = this.constructor.name;
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.cause = options.cause;
    this.metadata = options.metadata;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      requestId: this.requestId,
      metadata: this.metadata,
    };
  }
}

/**
 * Type guard to check if an error is a DomainError
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
