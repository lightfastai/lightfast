export class AuthError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name; // Ensures the name property is the class name
    this.cause = cause;
    // Set the prototype explicitly to allow instanceof to work correctly in some environments.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthConfigurationError extends AuthError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export class AuthUserRetrievalError extends AuthError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export class AuthUserCreationError extends AuthError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export class AuthUserConflictResolutionError extends AuthError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

// This can be used as a fallback or for more general issues within the auth process.
export class AuthenticationProcessError extends AuthError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}
