import { fal, InQueueQueueStatus } from "@fal-ai/client";

export interface FalGenerateImageOptions {
  prompt: string;
  webhookUrl: string;
  width?: number;
  height?: number;
  model?: string;
}

export interface FalGenerateImageResult extends InQueueQueueStatus {}

/**
 * Generate an image using Fal AI
 * @param options - prompt and generation options
 */
export async function generateImageWithFal({
  prompt,
  width = 1024,
  height = 1024,
  webhookUrl,
  model = "fal-ai/fast-sdxl",
}: FalGenerateImageOptions): Promise<FalGenerateImageResult> {
  const result = await fal.queue.submit(model, {
    input: {
      prompt,
      width,
      height,
    },
    webhookUrl,
  });

  return result;
}
