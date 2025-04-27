import { nanoid } from "@repo/lib";

import { env } from "../env.js";
import { Resource, ResourceVariant } from "../types.js";

interface FalTextToImageResponse {
  images: string[];
  seed: number;
}

// Create a simple ID generator
const generateId = () => nanoid();

export class FalService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://gateway.fal.ai/public";

  constructor() {
    if (!env.FAL_KEY) {
      console.warn(
        "FAL_KEY is not set. Text-to-image generation will not work.",
      );
    }
    this.apiKey = env.FAL_KEY || "";
  }

  async generateTextToImage(
    prompt: string,
    width: number = 1024,
    height: number = 1024,
    processingProfile: string = "default",
  ): Promise<{ imageData: Buffer; mimeType: string }> {
    if (!this.apiKey) {
      throw new Error("FAL_KEY is not set. Cannot generate images.");
    }

    try {
      const response = await fetch(`${this.baseUrl}/sdxl-lightning`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${this.apiKey}`,
        },
        body: JSON.stringify({
          prompt,
          height,
          width,
          num_images: 1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fal.ai API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as FalTextToImageResponse;

      // Convert base64 image to buffer
      if (!data.images || data.images.length === 0) {
        throw new Error("No images generated");
      }

      const imageStr = data.images[0];
      if (!imageStr) {
        throw new Error("No image data returned from API");
      }

      // Split the string and check if it has a data URL prefix
      const parts = imageStr.split(",");
      const imageBase64 = parts.length > 1 ? parts[1] : imageStr;

      if (!imageBase64) {
        throw new Error("Invalid image format received from API");
      }

      const imageBuffer = Buffer.from(imageBase64, "base64");

      return {
        imageData: imageBuffer,
        mimeType: "image/png", // SDXL outputs PNG
      };
    } catch (error) {
      console.error("Error generating image with Fal.ai:", error);
      throw error;
    }
  }

  createResourceFromImage(
    imageData: Buffer,
    mimeType: string,
    storageURL: string,
    processingProfile: string,
    width?: number,
    height?: number,
  ): Resource {
    const id = generateId();
    const timestamp = new Date();

    // Create a variant for the original image
    const variant: ResourceVariant = {
      id: `original-${id}`,
      width: width || 0,
      height: height || 0,
      url: storageURL,
    };

    return {
      id,
      mimeType,
      createdAt: timestamp,
      dimensions: width && height ? { width, height } : undefined,
      storageURL,
      variants: [variant],
      processingProfile,
    };
  }
}
