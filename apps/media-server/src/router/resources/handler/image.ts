import type { Context } from "hono";

import { generateImageWithFal } from "@repo/ai";

import type { CreateResourceSpecificInput } from "../schema/index.js";

export async function handleImageResource(c: Context) {
  const body = await c.req.json<CreateResourceSpecificInput>();
  try {
    const result = await generateImageWithFal({
      prompt: body.prompt,
      // Optionally, you can add width/height/model here if needed
    });
    return c.json({
      id: body.id,
      imageUrl: result.imageUrl,
      seed: result.seed,
    });
  } catch (error) {
    console.error(error);
    return c.json(
      { error: (error as Error).message || "Failed to generate image" },
      { status: 500 },
    );
  }
}
