import type { Inngest, InngestFunction } from "inngest";
import { serve } from "inngest/next";

export const createEventContext = (
  client: Inngest,
  functions: InngestFunction.Any[],
  servePath = "/api/inngest",
) =>
  serve({
    client,
    functions,
    servePath,
  });
