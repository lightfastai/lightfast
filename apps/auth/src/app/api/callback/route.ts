import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { client, setTokensNextHandler } from "@vendor/openauth/server";

const setCorsHeaders = (res: Response) => {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Request-Method", "*");
  res.headers.set("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
  res.headers.set("Access-Control-Allow-Headers", "content-type");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Access-Control-Allow-Credentials", "true");
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
  const redirectUri = url.searchParams.get("redirect_uri");
  const code = url.searchParams.get("code");
  const redirectUri = url.searchParams.get("redirect_uri");

  const exchanged = await client.exchange(
    code!,
    redirectUri ?? `${url.origin}/api/callback`,
  );

  console.log("Exchanged tokens:", exchanged);

  if (exchanged.err) {
    console.error("Error exchanging tokens:", exchanged.err);
    const response = NextResponse.json(exchanged.err, { status: 400 });
    setCorsHeaders(response);
    return response;
  }

  await setTokensNextHandler(exchanged.tokens.access, exchanged.tokens.refresh);

  // Check if this is an API request or browser request
  if (redirectUri) {
    // API request, return tokens as JSON
    const response = NextResponse.json({
      access: exchanged.tokens.access,
      refresh: exchanged.tokens.refresh,
      expiresIn: exchanged.tokens.expiresIn,
    });
    setCorsHeaders(response);
    return response;
  }

  // Browser request, redirect
  const response = NextResponse.redirect(`${url.origin}/`);
  setCorsHeaders(response);
  return response;
}
