import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ResultAsync } from "neverthrow";

import type { RequestContext } from "./create-secure-request-id";
import { secureApiRequestEnv } from "../../env";
import { REQUEST_ID_HEADER } from "./constants";
import { SecureRequestId } from "./create-secure-request-id";

/**
 * Error types for request ID validation failures
 */
export enum RequestIdErrorType {
  MISSING = "MISSING_REQUEST_ID",
  INVALID_FORMAT = "INVALID_REQUEST_ID_FORMAT",
  EXPIRED = "EXPIRED_REQUEST_ID",
  INVALID_CONTEXT = "INVALID_REQUEST_CONTEXT",
  INVALID_SIGNATURE = "INVALID_REQUEST_SIGNATURE",
}

// Error classes for request ID validation
export class RequestIdError extends Error {
  constructor(
    message: string,
    public type: RequestIdErrorType,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "RequestIdError";
  }
}

export class MissingRequestIdError extends RequestIdError {
  constructor(message = "Missing request ID") {
    super(message, RequestIdErrorType.MISSING, 401);
    this.name = "MissingRequestIdError";
  }
}

export class InvalidFormatRequestIdError extends RequestIdError {
  constructor(message = "Malformed request ID") {
    super(message, RequestIdErrorType.INVALID_FORMAT, 400);
    this.name = "InvalidFormatRequestIdError";
  }
}

export class ExpiredRequestIdError extends RequestIdError {
  constructor(message = "Expired request ID") {
    super(message, RequestIdErrorType.EXPIRED, 400);
    this.name = "ExpiredRequestIdError";
  }
}

export class InvalidContextRequestIdError extends RequestIdError {
  constructor(message = "Invalid request context") {
    super(message, RequestIdErrorType.INVALID_CONTEXT, 400);
    this.name = "InvalidContextRequestIdError";
  }
}

export class InvalidSignatureRequestIdError extends RequestIdError {
  constructor(message = "Invalid signature") {
    super(message, RequestIdErrorType.INVALID_SIGNATURE, 400);
    this.name = "InvalidSignatureRequestIdError";
  }
}

export class UnknownRequestIdError extends Error {
  constructor(message = "Unknown request ID error") {
    super(message);
    this.name = "UnknownRequestIdError";
  }
}

// Union type of all possible request ID errors
export type RequestIdValidationError =
  | MissingRequestIdError
  | InvalidFormatRequestIdError
  | ExpiredRequestIdError
  | InvalidContextRequestIdError
  | InvalidSignatureRequestIdError
  | RequestIdError
  | UnknownRequestIdError;

export interface RequestIdPathConfig {
  publicPaths: readonly string[];
  protectedPaths: readonly string[];
}

export interface RequestIdResponse {
  response: NextResponse;
  newRequestId?: string;
  error?: RequestIdValidationError;
}

export async function withRequestIdUnsafe(
  request: NextRequest,
  pathConfig: RequestIdPathConfig,
): Promise<RequestIdResponse> {
  const requestContext: RequestContext = {
    method: request.method,
    path: request.nextUrl.pathname,
    userAgent: request.headers.get("user-agent") ?? undefined,
  };

  // 1. Check if this is a path that needs request ID handling
  const isPublicPath = pathConfig.publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );
  const isProtectedPath = pathConfig.protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!isProtectedPath && !isPublicPath) {
    // Regular page load or static asset - generate new ID if needed
    const existingRequestId = request.headers.get(REQUEST_ID_HEADER);
    const headers = new Headers(request.headers);

    if (!existingRequestId) {
      const newRequestId = await SecureRequestId.generate(requestContext);
      headers.set(REQUEST_ID_HEADER, newRequestId);

      return {
        response: NextResponse.next({
          request: {
            ...request,
            headers,
          },
        }),
        newRequestId,
      };
    }

    return {
      response: NextResponse.next({
        request: {
          ...request,
          headers,
        },
      }),
    };
  }

  // 2. Handle protected paths
  if (isProtectedPath) {
    const existingRequestId = request.headers.get(REQUEST_ID_HEADER);

    // No request ID for protected path
    if (!existingRequestId) {
      const newRequestId = await SecureRequestId.generate(requestContext);
      const error = new MissingRequestIdError(
        "This endpoint requires a valid request ID",
      );

      return {
        response: new NextResponse(
          JSON.stringify({
            type: error.type,
            error: error.name,
            message: error.message,
          }),
          {
            status: error.statusCode,
            headers: {
              "Content-Type": "application/json",
              // Generate one anyway to help client fix their request
              [REQUEST_ID_HEADER]: newRequestId,
            },
          },
        ),
        newRequestId,
        error,
      };
    }

    // Check if request ID has valid structure before full verification
    const parsed = SecureRequestId.parse(existingRequestId);
    if (!parsed) {
      // Malformed request ID - generate a new one
      const newRequestId = await SecureRequestId.generate(requestContext);
      const error = new InvalidFormatRequestIdError(
        "The provided request ID has an invalid format",
      );

      return {
        response: new NextResponse(
          JSON.stringify({
            type: error.type,
            error: error.name,
            message: error.message,
          }),
          {
            status: error.statusCode,
            headers: {
              "Content-Type": "application/json",
              [REQUEST_ID_HEADER]: newRequestId,
            },
          },
        ),
        newRequestId,
        error,
      };
    }

    // Check if request ID is expired
    const isExpired = SecureRequestId.isExpired(existingRequestId);

    // If expired and auto-refresh is enabled, handle immediately
    if (isExpired && secureApiRequestEnv.AUTO_REFRESH_EXPIRED_IDS) {
      // First verify signature to ensure this is a legitimate request ID (prevent forgery)
      const isValidSignature = await SecureRequestId.verifySignature(
        existingRequestId,
        requestContext,
      );

      if (isValidSignature) {
        // Valid signature but expired - generate a new one and continue
        // This auto-refresh mechanism prevents users from encountering expired request ID errors
        // when they stay on the site for longer than the MAX_AGE period (5 minutes)
        const headers = new Headers(request.headers);
        const newRequestId = await SecureRequestId.generate(requestContext);
        headers.set(REQUEST_ID_HEADER, newRequestId);

        return {
          response: NextResponse.next({
            request: {
              ...request,
              headers,
            },
          }),
          newRequestId,
        };
      }
    }

    // If expired and auto-refresh is disabled, return a clear error
    if (isExpired && !secureApiRequestEnv.AUTO_REFRESH_EXPIRED_IDS) {
      const newRequestId = await SecureRequestId.generate(requestContext);
      const error = new ExpiredRequestIdError("The request ID has expired");

      return {
        response: new NextResponse(
          JSON.stringify({
            type: error.type,
            error: error.name,
            message: error.message,
          }),
          {
            status: error.statusCode,
            headers: {
              "Content-Type": "application/json",
              [REQUEST_ID_HEADER]: newRequestId,
            },
          },
        ),
        newRequestId,
        error,
      };
    }

    // Verify context matches
    const isValidContext = await SecureRequestId.verifyContext(
      existingRequestId,
      requestContext,
    );

    if (!isValidContext) {
      // Context mismatch - likely a replayed request
      const newRequestId = await SecureRequestId.generate(requestContext);
      const error = new InvalidContextRequestIdError(
        "The request ID is not valid for this request context",
      );

      return {
        response: new NextResponse(
          JSON.stringify({
            type: error.type,
            error: error.name,
            message: error.message,
          }),
          {
            status: error.statusCode,
            headers: {
              "Content-Type": "application/json",
              [REQUEST_ID_HEADER]: newRequestId,
            },
          },
        ),
        newRequestId,
        error,
      };
    }

    // Verify signature only
    const isValidSignature = await SecureRequestId.verifySignature(
      existingRequestId,
      requestContext,
    );

    if (!isValidSignature) {
      // Invalid signature - potential tampering
      const newRequestId = await SecureRequestId.generate(requestContext);
      const error = new InvalidSignatureRequestIdError(
        "The request ID signature is invalid",
      );

      return {
        response: new NextResponse(
          JSON.stringify({
            type: error.type,
            error: error.name,
            message: error.message,
          }),
          {
            status: error.statusCode,
            headers: {
              "Content-Type": "application/json",
              [REQUEST_ID_HEADER]: newRequestId,
            },
          },
        ),
        newRequestId,
        error,
      };
    }

    // Valid request ID - proceed with existing headers
    const headers = new Headers(request.headers);
    return {
      response: NextResponse.next({
        request: {
          ...request,
          headers,
        },
      }),
    };
  }

  // 3. Handle public paths - always generate new ID
  const headers = new Headers(request.headers);
  const newRequestId = await SecureRequestId.generate(requestContext);
  headers.set(REQUEST_ID_HEADER, newRequestId);

  return {
    response: NextResponse.next({
      request: {
        ...request,
        headers,
      },
    }),
    newRequestId,
  };
}

/**
 * Safe wrapper around withRequestId that returns a Result type
 */
export const withRequestIdSafe = (
  request: NextRequest,
  pathConfig: RequestIdPathConfig,
) => {
  return ResultAsync.fromPromise(
    withRequestIdUnsafe(request, pathConfig),
    (error): RequestIdValidationError => {
      // If it's already one of our error types, return it
      if (
        error instanceof MissingRequestIdError ||
        error instanceof InvalidFormatRequestIdError ||
        error instanceof ExpiredRequestIdError ||
        error instanceof InvalidContextRequestIdError ||
        error instanceof InvalidSignatureRequestIdError ||
        error instanceof RequestIdError
      ) {
        return error;
      }
      // Otherwise wrap in UnknownRequestIdError
      return new UnknownRequestIdError(
        error instanceof Error
          ? error.message
          : "Unknown error while processing request ID",
      );
    },
  );
};

/**
 * Backward compatible implementation of withRequestId
 * This maintains the original API while using the safe implementation internally
 */
export async function withRequestId(
  request: NextRequest,
  pathConfig: RequestIdPathConfig,
): Promise<NextResponse> {
  const result = await withRequestIdSafe(request, pathConfig);
  return result.match(
    // On success, return the response
    (data) => data.response,
    // On error, create an error response
    (error) => {
      const statusCode =
        error instanceof RequestIdError ? error.statusCode : 500;
      const errorType =
        error instanceof RequestIdError
          ? error.type
          : RequestIdErrorType.INVALID_FORMAT;

      return new NextResponse(
        JSON.stringify({
          type: errorType,
          error: error.name,
          message: error.message,
        }),
        {
          status: statusCode,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    },
  );
}
