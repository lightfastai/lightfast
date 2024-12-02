"use server";

import type { Inngest, InngestFunction } from "inngest";
import { serve } from "inngest/next";

export const createEventContext = (
  client: Inngest,
  functions: InngestFunction.Any[],
) =>
  serve({
    client,
    functions,
  });
