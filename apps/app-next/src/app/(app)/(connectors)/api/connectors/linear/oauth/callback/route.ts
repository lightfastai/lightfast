import { completeLinearConnectorOAuth } from "@api/app/services/connectors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const result = await completeLinearConnectorOAuth({
    requestUrl: req.url,
  });
  return NextResponse.redirect(result.redirectUrl);
}
