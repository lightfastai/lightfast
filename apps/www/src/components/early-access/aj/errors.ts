export class ArcjetProtectionError extends Error {
  constructor(
    message: string,
    public originalError: Error,
  ) {
    super(message);
    this.name = "ArcjetProtectionError";
  }
}

export class ArcjetEmailError extends Error {
  constructor(
    message: string,
    public reason: string,
  ) {
    super(message);
    this.name = "ArcjetEmailError";
  }
}

export class ArcjetRateLimitError extends Error {
  constructor(
    message: string,
    public reason: string,
  ) {
    super(message);
    this.name = "ArcjetRateLimitError";
  }
}

export class ArcjetSecurityError extends Error {
  constructor(
    message: string,
    public reason: string,
  ) {
    super(message);
    this.name = "ArcjetSecurityError";
  }
}

export interface ArcjetErrorResponse {
  type: string;
  error: string;
  message: string;
}

export interface NextErrorResponse {
  type: string;
  error: string;
  message: string;
}
