export function GET(): Response {
  return Response.json({
    service: "mcp",
    status: "ok",
  });
}
