export enum EarlyAccessErrorType {
  BAD_REQUEST = "BAD_REQUEST",
  INVALID_EMAIL = "INVALID_EMAIL",
  RATE_LIMIT = "RATE_LIMIT",
  SECURITY_CHECK = "SECURITY_CHECK",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  NO_REQUEST_ID = "NO_REQUEST_ID",
  INVALID_REQUEST_ID = "INVALID_REQUEST_ID",
}

export interface NextErrorResponse {
  type: EarlyAccessErrorType;
  error: string;
  message: string;
}

// Map error types to user-friendly messages
export const EarlyAccessFormErrorMap: Record<EarlyAccessErrorType, string> = {
  [EarlyAccessErrorType.BAD_REQUEST]:
    "Invalid request format. Please try again.",
  [EarlyAccessErrorType.INVALID_EMAIL]: "Please enter a valid email address.",
  [EarlyAccessErrorType.RATE_LIMIT]:
    "Too many attempts. Please try again later.",
  [EarlyAccessErrorType.SECURITY_CHECK]:
    "Security check failed. Please try again.",
  [EarlyAccessErrorType.SERVICE_UNAVAILABLE]:
    "Service is temporarily unavailable. Please try again later.",
  [EarlyAccessErrorType.INTERNAL_SERVER_ERROR]:
    "An unexpected error occurred. Please try again later.",
  [EarlyAccessErrorType.NO_REQUEST_ID]:
    "An unexpected error occurred. Please try again later.",
  [EarlyAccessErrorType.INVALID_REQUEST_ID]:
    "An unexpected error occurred. Please try again later.",
};
