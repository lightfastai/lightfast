export enum EarlyAccessErrorType {
  RATE_LIMIT = "RATE_LIMIT",
  INVALID_EMAIL = "INVALID_EMAIL",
  ALREADY_REGISTERED = "ALREADY_REGISTERED",
  SECURITY_CHECK = "SECURITY_CHECK",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

export interface EarlyAccessError {
  type: EarlyAccessErrorType;
  message: string;
}
