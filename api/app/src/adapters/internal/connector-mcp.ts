import { handleXConnectorMcpRequest as handleXConnectorMcpServiceRequest } from "../../services/connectors/x-mcp-bridge";

const MALFORMED_JSON_REQUEST = Symbol("malformed-json");

export async function handleXConnectorMcpRequest(
  request: Request
): Promise<Response> {
  const token = bearerToken(request.headers);
  if (!token) {
    return unauthorizedResponse();
  }

  const parsedBody = await parseRequestBody(request);
  if (parsedBody === MALFORMED_JSON_REQUEST) {
    return invalidRequestResponse();
  }

  return handleXConnectorMcpServiceRequest({
    appOrigin: new URL(request.url).origin,
    parsedBody,
    request,
    token,
  });
}

async function parseRequestBody(request: Request): Promise<unknown> {
  if (request.method !== "POST") {
    return;
  }

  const text = await request.clone().text();
  if (!text) {
    return;
  }

  try {
    return JSON.parse(text);
  } catch {
    return MALFORMED_JSON_REQUEST;
  }
}

function bearerToken(headers: Headers): string | null {
  const authorization = headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function unauthorizedResponse() {
  return new Response("Unauthorized", { status: 401 });
}

function invalidRequestResponse() {
  return new Response("Invalid request body", { status: 400 });
}
