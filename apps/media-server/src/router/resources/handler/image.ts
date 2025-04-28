import type { Context } from "hono";

import { generateImageWithFal } from "@repo/ai";

import type { CreateResourceSpecificInput } from "../schema/index.js";
import { createImageSuccessWebhookUrl } from "../../../lib/create-base-url.js";

export async function handleImageResource(c: Context) {
  const body = await c.req.json<CreateResourceSpecificInput>();
  try {
    const result = await generateImageWithFal({
      prompt: body.prompt,
      webhookUrl: createImageSuccessWebhookUrl(c, { id: body.id }),
    });
    return c.json({
      requestId: result.request_id,
    });
  } catch (error) {
    console.error(error);
    return c.json(
      { error: (error as Error).message || "Failed to generate image" },
      { status: 500 },
    );
  }
}
