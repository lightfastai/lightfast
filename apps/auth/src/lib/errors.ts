export enum AuthErrorType {
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
  type: AuthErrorType;
  error: string;
  message: string;
}

// Map error types to user-friendly messages
export const AuthErrorMap: Record<AuthErrorType, string> = {
  [AuthErrorType.BAD_REQUEST]:
    "Invalid request format. Please try again.",
  [AuthErrorType.INVALID_EMAIL]: "Please enter a valid email address.",
  [AuthErrorType.RATE_LIMIT]:
    "Too many attempts. Please try again later.",
  [AuthErrorType.SECURITY_CHECK]:
    "Security check failed. Please try again.",
  [AuthErrorType.SERVICE_UNAVAILABLE]:
    "Service is temporarily unavailable. Please try again later.",
  [AuthErrorType.INTERNAL_SERVER_ERROR]:
    "An unexpected error occurred. Please try again later.",
  [AuthErrorType.NO_REQUEST_ID]:
    "An unexpected error occurred. Please try again later.",
  [AuthErrorType.INVALID_REQUEST_ID]:
    "An unexpected error occurred. Please try again later.",
};