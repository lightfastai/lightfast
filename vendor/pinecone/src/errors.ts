/**
 * Error classes for Pinecone operations
 *
 * @see docs/architecture/phase1/mastra-integration.md
 */

/**
 * Base error class for Pinecone operations
 */
export class PineconeError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "PineconeError";
    Object.setPrototypeOf(this, PineconeError.prototype);
  }
}

/**
 * Connection or network error
 */
export class PineconeConnectionError extends PineconeError {
  constructor(message: string, cause?: unknown) {
    super(message, "CONNECTION_ERROR", cause);
    this.name = "PineconeConnectionError";
    Object.setPrototypeOf(this, PineconeConnectionError.prototype);
  }
}

/**
 * Rate limit exceeded
 */
export class PineconeRateLimitError extends PineconeError {
  constructor(message: string, cause?: unknown) {
    super(message, "RATE_LIMIT_ERROR", cause);
    this.name = "PineconeRateLimitError";
    Object.setPrototypeOf(this, PineconeRateLimitError.prototype);
  }
}

/**
 * Index or resource not found
 */
export class PineconeNotFoundError extends PineconeError {
  constructor(message: string, cause?: unknown) {
    super(message, "NOT_FOUND", cause);
    this.name = "PineconeNotFoundError";
    Object.setPrototypeOf(this, PineconeNotFoundError.prototype);
  }
}

/**
 * Invalid request (e.g., dimension mismatch)
 */
export class PineconeInvalidRequestError extends PineconeError {
  constructor(message: string, cause?: unknown) {
    super(message, "INVALID_REQUEST", cause);
    this.name = "PineconeInvalidRequestError";
    Object.setPrototypeOf(this, PineconeInvalidRequestError.prototype);
  }
}
