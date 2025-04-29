import { fal, InQueueQueueStatus } from "@fal-ai/client";

export interface FalGenerateImageOptions {
  prompt: string;
  webhookUrl: string;
  width: number;
  height: number;
  model: string;
}

export interface FalGenerateImageSuccessPayload {
  request_id: string;
  gateway_request_id: string;
  status: string;
  error: unknown;
  payload: {
    prompt: string;
    images: {
      url: string;
      content_type: string;
      width: number;
      height: number;
    }[];
    seed: number;
  };
}

export interface FalGenerateImageResult extends InQueueQueueStatus {}

/**
 * Generate an image using Fal AI
 * @param options - prompt and generation options
 */
export async function generateImageWithFal({
  prompt,
  width,
  height,
  webhookUrl,
  model,
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
