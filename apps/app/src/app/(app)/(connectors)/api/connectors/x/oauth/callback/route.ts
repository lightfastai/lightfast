import { completeXConnectorOAuth } from "@api/app/services/connectors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const result = await completeXConnectorOAuth({
    requestUrl: req.url,
  });
  return NextResponse.redirect(result.redirectUrl);
}
