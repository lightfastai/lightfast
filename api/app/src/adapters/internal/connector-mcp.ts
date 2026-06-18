import { handleXConnectorMcpRequest as handleXConnectorMcpServiceRequest } from "../../services/connectors";

export async function handleXConnectorMcpRequest(
  request: Request
): Promise<Response> {
  return handleXConnectorMcpServiceRequest({ request });
}
