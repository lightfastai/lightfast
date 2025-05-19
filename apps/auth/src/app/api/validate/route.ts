import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { authSubjects, client } from "@vendor/openauth/server";

const setCorsHeaders = (res: Response) => {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Request-Method", "*");
  res.headers.set("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
  res.headers.set("Access-Control-Allow-Headers", "*");
};

export const OPTIONS = () => {
  const response = new Response(null, {
    status: 204,
  });
  setCorsHeaders(response);
  return response;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, refresh } = body;

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "No token provided" },
        { status: 400 },
      );
    }

    console.log("Validating token:", token, refresh);

    const verified = await client.verify(authSubjects, token, {
      refresh,
    });

    if (verified.err) {
      return NextResponse.json(
        { valid: false, error: verified.err },
        { status: 401 },
      );
    }

    // Return validation result with user info and possibly refreshed tokens
    return NextResponse.json({
      valid: true,
      subject: verified.subject,
      tokens: verified.tokens,
    });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json(
      { valid: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
