import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { Token, UserSession } from "@vendor/openauth";
import { $SessionType } from "@vendor/openauth";
import { authSubjects, client } from "@vendor/openauth/server";

const setCorsHeaders = (res: NextResponse) => {
  // Allow requests from any origin during development
  // For production, restrict this to your app's domain
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  // Allow credentials (cookies, authorization headers, etc.)
  res.headers.set("Access-Control-Allow-Credentials", "true");
};

// Handle OPTIONS preflight requests
export const OPTIONS = () => {
  const response = NextResponse.json({}, { status: 200 });
  setCorsHeaders(response);
  return response;
};

export async function POST(req: NextRequest) {
  let response;
  try {
    const body = (await req.json()) as Omit<Token, "expiresIn">;
    const { accessToken, refreshToken } = body;

    if (!accessToken) {
      response = NextResponse.json(
        { valid: false, error: "No token provided" },
        { status: 400 },
      );
      setCorsHeaders(response); // Ensure CORS headers on this error response
      return response;
    }

    console.log("Validating token:", accessToken, refreshToken);

    const verified = await client.verify(authSubjects, accessToken, {
      refresh: refreshToken,
    });

    if (verified.err) {
      response = NextResponse.json(
        { valid: false, error: verified.err },
        { status: 401 },
      );
      setCorsHeaders(response); // Ensure CORS headers on this error response
      return response;
    }

    // Return validation result with user info and possibly refreshed tokens
    response = NextResponse.json<UserSession>({
      type: $SessionType.Enum.user,
      user: {
        id: verified.subject.properties.id,
        accessToken: verified.tokens?.access || accessToken,
        refreshToken: verified.tokens?.refresh || refreshToken,
        expiresIn: verified.tokens?.expiresIn ?? 3600,
      },
    });

    setCorsHeaders(response); // Ensure CORS headers on the success response
    return response;
  } catch (error) {
    console.error("Token validation error:", error);
    response = NextResponse.json(
      { valid: false, error: "Internal server error" },
      { status: 500 },
    );
    setCorsHeaders(response); // Ensure CORS headers on this catch-all error response
    return response;
  }
}
