import { mcpUnauthorizedResponse } from "../../auth/verify-token";
import { createMcpContext } from "../../context";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

async function handleMcpRequest(request: Request): Promise<Response> {
  try {
    await createMcpContext(request);
  } catch (error) {
    return mcpUnauthorizedResponse(error);
  }

  return Response.json(
    {
      error: "not_implemented",
      message: "Hosted MCP tool execution is not implemented yet.",
    },
    { status: 501 }
  );
}
