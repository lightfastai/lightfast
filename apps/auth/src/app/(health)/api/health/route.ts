import { NextResponse } from "next/server";

export const runtime = "edge";

/**
 * Configure basic CORS headers
 * You should extend this to match your needs
 */
const setCorsHeaders = (res: Response) => {
  res.headers.set("Access-Control-Allow-Origin", "*"); // Consider restricting this in production (e.g., to http://localhost:5173 in dev)
  res.headers.set("Access-Control-Request-Method", "*");
  res.headers.set("Access-Control-Allow-Methods", "OPTIONS, GET"); // Only GET/OPTIONS needed for health check
  res.headers.set("Access-Control-Allow-Headers", "*"); // Allow common headers
};

export function GET() {
  const response = NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
    },
  );
  response.headers.set("Cache-Control", "no-store");
  setCorsHeaders(response); // Apply CORS headers to the GET response
  return response;
}

// Add OPTIONS handler for preflight requests
export const OPTIONS = () => {
  const response = new Response(null, {
    status: 204,
  });
  setCorsHeaders(response);
  return response;
};
