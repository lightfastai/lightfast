import { NextResponse } from "next/server";

export const runtime = "edge";

export const GET = (): NextResponse => {
  const response = NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
};
