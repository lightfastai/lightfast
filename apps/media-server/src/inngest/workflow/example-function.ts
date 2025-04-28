// @ts-expect-error: vendor package may not have types
import type { InngestFunctionContext } from "@vendor/inngest";

import { inngest } from "../client/client";

const exampleFunction = inngest.createFunction(
  { id: "example", name: "Example Function" },
  { event: "media-server/example" },
  async ({ event, step }: InngestFunctionContext) => {
    // Example logic
    return { message: "Hello from Inngest!", event };
  },
);

export default exampleFunction;
