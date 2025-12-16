/**
 * Base error class for Lightfast Memory API errors
 */
export class LightfastError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LightfastError";
    Object.setPrototypeOf(this, LightfastError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      requestId: this.requestId,
      status: this.status,
    };
  }
}

/**
 * Authentication failed - invalid or expired API key
 */
export class AuthenticationError extends LightfastError {
  constructor(message: string, requestId?: string) {
    super("UNAUTHORIZED", message, requestId, 401);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Request validation failed - invalid parameters
 */
export class ValidationError extends LightfastError {
  constructor(
    message: string,
    public readonly details?: Record<string, string[]>,
    requestId?: string,
  ) {
    super("VALIDATION_ERROR", message, requestId, 400);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Resource not found
 */
export class NotFoundError extends LightfastError {
  constructor(message: string, requestId?: string) {
    super("NOT_FOUND", message, requestId, 404);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Rate limit exceeded
 */
export class RateLimitError extends LightfastError {
  constructor(
    message: string,
    public readonly retryAfter?: number,
    requestId?: string,
  ) {
    super("RATE_LIMITED", message, requestId, 429);
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Server error - something went wrong on Lightfast's side
 */
export class ServerError extends LightfastError {
  constructor(message: string, requestId?: string) {
    super("SERVER_ERROR", message, requestId, 500);
    this.name = "ServerError";
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/**
 * Network error - failed to reach the API
 */
export class NetworkError extends LightfastError {
  constructor(message: string, cause?: unknown) {
    super("NETWORK_ERROR", message, undefined, undefined, cause);
    this.name = "NetworkError";
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}
