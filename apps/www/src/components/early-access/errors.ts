export enum EarlyAccessErrorType {
  RATE_LIMIT = "RATE_LIMIT",
  INVALID_EMAIL = "INVALID_EMAIL",
  SECURITY_CHECK = "SECURITY_CHECK",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  BAD_REQUEST = "BAD_REQUEST",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
}

export interface NextErrorResponse {
  type: string;
  error: string;
  message: string;
}

// Map error types to user-friendly messages
export const EarlyAccessFormErrorMap: Record<EarlyAccessErrorType, string> = {
  [EarlyAccessErrorType.RATE_LIMIT]:
    "Too many attempts. Please try again later.",
  [EarlyAccessErrorType.INVALID_EMAIL]: "Please provide a valid email address.",
  [EarlyAccessErrorType.SECURITY_CHECK]:
    "Security check failed. Please try again later.",
  [EarlyAccessErrorType.SERVICE_UNAVAILABLE]:
    "Service is temporarily unavailable. Please try again later.",
  [EarlyAccessErrorType.BAD_REQUEST]: "Invalid request. Please try again.",
  [EarlyAccessErrorType.INTERNAL_SERVER_ERROR]:
    "An unexpected error occurred. Please try again later.",
};
