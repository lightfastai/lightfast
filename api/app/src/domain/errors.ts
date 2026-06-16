export type DomainErrorKind = "authz" | "internal" | "not_found" | "validation";

export class DomainError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly kind: DomainErrorKind;

  constructor(
    kind: DomainErrorKind,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "DomainError";
    this.kind = kind;
    this.code = code;
    this.details = details;
  }
}

export class AuthzError extends DomainError {
  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
    options?: ErrorOptions
  ) {
    super("authz", code, message, details, options);
    this.name = "AuthzError";
  }
}

export class ValidationError extends DomainError {
  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
    options?: ErrorOptions
  ) {
    super("validation", code, message, details, options);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends DomainError {
  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
    options?: ErrorOptions
  ) {
    super("not_found", code, message, details, options);
    this.name = "NotFoundError";
  }
}

export class InternalDomainError extends DomainError {
  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
    options?: ErrorOptions
  ) {
    super("internal", code, message, details, options);
    this.name = "InternalDomainError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
