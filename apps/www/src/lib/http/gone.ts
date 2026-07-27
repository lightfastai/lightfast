const headers = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400",
} as const;

export function GET(): Response {
  return new Response(null, { status: 410, headers });
}

export function HEAD(): Response {
  return new Response(null, { status: 410, headers });
}
