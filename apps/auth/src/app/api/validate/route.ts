import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { subjects } from "../../../auth/subjects";
import { client } from "../../auth";

// Configure CORS headers for the Electron app
const setCorsHeaders = (res: Response) => {
  // For production, consider restricting to specific origins
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
};

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  const response = new Response(null, { status: 204 });
  setCorsHeaders(response);
  return response;
}

export async function POST(req: NextRequest) {
  try {
    const { token, refresh } = await req.json();

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Missing token" },
        { status: 400 },
      );
    }

    // Validate the token
    const verified = await client.verify(subjects, token, {
      refresh: refresh,
    });

    if (verified.err) {
      const response = NextResponse.json(
        { valid: false, error: verified.err },
        { status: 401 },
      );
      setCorsHeaders(response);
      return response;
    }

    // Return new tokens if refreshed
    const responseData: any = { valid: true, subject: verified.subject };
    if (verified.tokens) {
      responseData.tokens = {
        access: verified.tokens.access,
        refresh: verified.tokens.refresh,
      };
    }

    const response = NextResponse.json(responseData);
    setCorsHeaders(response);
    return response;
  } catch (error: any) {
    const response = NextResponse.json(
      { valid: false, error: error.message || "Invalid request" },
      { status: 400 },
    );
    setCorsHeaders(response);
    return response;
  }
}
