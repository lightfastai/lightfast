import { handleXConnectorMcpRequest } from "@api/app/services/connectors";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return await handleXConnectorMcpRequest({ request: req });
}

export async function POST(req: Request) {
  return await handleXConnectorMcpRequest({ request: req });
}

export async function DELETE(req: Request) {
  return await handleXConnectorMcpRequest({ request: req });
}
