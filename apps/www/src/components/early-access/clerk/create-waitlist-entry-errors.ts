export class ClerkError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "ClerkError";
  }
}

export class ClerkRateLimitError extends ClerkError {
  constructor(
    message: string,
    public retryAfter?: string,
  ) {
    super(message);
    this.name = "ClerkRateLimitError";
  }
}

export class ClerkValidationError extends ClerkError {
  constructor(message: string) {
    super(message, 400);
    this.name = "ClerkValidationError";
  }
}

export class ClerkAuthenticationError extends ClerkError {
  constructor(message: string) {
    super(message, 401);
    this.name = "ClerkAuthenticationError";
  }
}

export class ClerkSecurityError extends ClerkError {
  constructor(message: string) {
    super(message, 451);
    this.name = "ClerkSecurityError";
  }
}

export class UnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownError";
  }
}

// Union type of all possible Clerk errors
export type ClerkWaitlistError =
  | ClerkRateLimitError
  | ClerkValidationError
  | ClerkAuthenticationError
  | ClerkSecurityError
  | ClerkError
  | UnknownError;
