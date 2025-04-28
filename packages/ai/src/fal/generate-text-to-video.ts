import { fal, InQueueQueueStatus } from "@fal-ai/client";

export interface FalGenerateVideoOptions {
  prompt: string;
  webhookUrl: string;
  duration?: number;
  model?: string;
}

export interface FalGenerateVideoResult extends InQueueQueueStatus {}

/**
 * Generate a video using Fal AI
 * @param options - prompt and generation options
 */

export async function generateVideoWithFal({
  prompt,
  duration = 1,
  webhookUrl,
  model = "fal-ai/kling-video/v2/master/text-to-video",
}: FalGenerateVideoOptions): Promise<FalGenerateVideoResult> {
  const result = await fal.queue.submit(model, {
    input: {
      prompt,
      duration,
    },
    webhookUrl,
  });

  return result;
}
