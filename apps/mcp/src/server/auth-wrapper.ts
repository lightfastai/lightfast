import type { HostedMcpAuthInfo } from "../context";
import { McpTokenVerificationError } from "../auth/verify-token";

type VerifyHostedMcpAuthInfo = (
  request: Request,
  bearerToken?: string
) => HostedMcpAuthInfo | undefined | Promise<HostedMcpAuthInfo | undefined>;

export function withHostedMcpAuth(
  handler: (request: Request) => Response | Promise<Response>,
  verifyToken: VerifyHostedMcpAuthInfo,
  options: {
    required?: boolean;
    resourceMetadataPath?: string;
    resourceUrl: string;
  }
): (request: Request) => Promise<Response> {
  const {
    required = false,
    resourceMetadataPath = "/.well-known/oauth-protected-resource",
    resourceUrl,
  } = options;

  return async (request) => {
    const resourceMetadataUrl = `${resourceUrl}${resourceMetadataPath}`;
    const bearerToken = readBearerToken(request);
    let authInfo: HostedMcpAuthInfo | undefined;

    try {
      authInfo = await verifyToken(request, bearerToken);
    } catch (error) {
      if (error instanceof McpTokenVerificationError) {
        return authErrorResponse(error, { resourceMetadataUrl });
      }

      console.error("Unexpected error authenticating bearer token:", error);
      return Response.json(
        {
          error: "server_error",
          error_description: "Internal Server Error",
        },
        { status: 500 }
      );
    }

    if (required && !authInfo) {
      return authErrorResponse(
        new McpTokenVerificationError(
          "missing_token",
          "Bearer token is required."
        ),
        { resourceMetadataUrl }
      );
    }

    if (!authInfo) {
      return handler(request);
    }

    if (authInfo.expiresAt && authInfo.expiresAt < Date.now() / 1000) {
      return authErrorResponse(
        new McpTokenVerificationError("invalid_token", "Token has expired."),
        { resourceMetadataUrl }
      );
    }

    (
      request as Request & {
        auth?: HostedMcpAuthInfo;
      }
    ).auth = authInfo;
    return handler(request);
  };
}

function readBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

function authErrorResponse(
  error: McpTokenVerificationError,
  input: { resourceMetadataUrl: string }
): Response {
  if (error.status === 503) {
    return Response.json(
      {
        error: error.code,
        error_description: error.message,
      },
      {
        headers: {
          "Retry-After": "2",
        },
        status: 503,
      }
    );
  }

  return Response.json(
    {
      error: error.code,
      error_description: error.message,
    },
    {
      headers: {
        "WWW-Authenticate": `Bearer error="${error.code}", error_description="${error.message}", resource_metadata="${input.resourceMetadataUrl}"`,
      },
      status: error.status,
    }
  );
}
