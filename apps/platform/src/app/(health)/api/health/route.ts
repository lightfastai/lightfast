export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    status: "ok",
    service: "memory",
    timestamp: new Date().toISOString(),
  });
}
