import { fal } from "@fal-ai/client";

export interface FalGenerateImageOptions {
  prompt: string;
  width?: number;
  height?: number;
  model?: string;
}

export interface FalImageResult {
  images?: Array<{ url: string }>;
  image?: { url: string };
  seed?: number;
  [key: string]: unknown;
}

export interface FalGenerateImageResult {
  imageUrl: string;
  seed?: number;
  raw?: unknown;
}

/**
 * Generate an image using Fal AI
 * @param options - prompt and generation options
 */
export async function generateImageWithFal({
  prompt,
  width = 1024,
  height = 1024,
  model = "fal-ai/fast-sdxl",
}: FalGenerateImageOptions): Promise<FalGenerateImageResult> {
  const result = (await fal.run(model, {
    input: {
      prompt,
      width,
      height,
    },
  })) as FalImageResult;

  // Fal returns a URL to the generated image
  const imageUrl = result.images?.[0]?.url || result.image?.url;
  if (!imageUrl) {
    throw new Error("No image URL returned from Fal AI");
  }

  return {
    imageUrl,
    seed: result.seed,
    raw: result,
  };
}
