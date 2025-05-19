import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { client, setTokensNextHandler } from "@vendor/openauth/server";

const setCorsHeaders = (res: Response) => {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Request-Method", "*");
  res.headers.set("Access-Control-Allow-Methods", "OPTIONS, GET");
  res.headers.set("Access-Control-Allow-Headers", "*");
};

export const OPTIONS = () => {
  const response = new Response(null, {
    status: 204,
  });
  setCorsHeaders(response);
  return response;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  const exchanged = await client.exchange(code!, `${url.origin}/api/callback`);

  if (exchanged.err) return NextResponse.json(exchanged.err, { status: 400 });

  await setTokensNextHandler(exchanged.tokens.access, exchanged.tokens.refresh);

  return NextResponse.redirect(`${url.origin}/`);
}
