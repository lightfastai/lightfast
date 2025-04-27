import type { Context } from "hono";

import type { CreateResourceSpecificInput } from "../schema/index.js";

export async function handleVideoResource(c: Context) {
  const body = await c.req.json<CreateResourceSpecificInput>();
  // body is now fully typed!
  // we send the prompt to a video-specific router for generation.
  // we return the resource to the client which can download it.
  return c.json(
    { message: "Resource generate disabled" },
    {
      status: 500,
    },
  );
}
