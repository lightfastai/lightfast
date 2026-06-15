export function getHealth(request: Request): Response {
  const authToken = process.env.HEALTH_CHECK_AUTH_TOKEN;

  if (authToken) {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return Response.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }

    const bearerMatch = /^Bearer\s+(.+)$/i.exec(authHeader);
    if (!bearerMatch?.[1] || bearerMatch[1] !== authToken) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return Response.json(
    {
      environment: process.env.NODE_ENV ?? "development",
      service: "app",
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
