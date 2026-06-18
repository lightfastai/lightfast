import { createInngestRouteContext } from "../../inngest";

export type InngestMethod = "GET" | "POST" | "PUT";

export async function handleInngestRequest(
  request: Request,
  method: InngestMethod
): Promise<Response> {
  const handlers = createInngestRouteContext();
  const handler = handlers[method] as (
    request: Request,
    context: unknown
  ) => Promise<Response>;

  return handler(request, {});
}
