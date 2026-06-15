import { handleMcpProxyCallRequest } from "../_server";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return await handleMcpProxyCallRequest(request);
}
