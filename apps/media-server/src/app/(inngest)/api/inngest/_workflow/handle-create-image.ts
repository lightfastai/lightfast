import { generateImageWithFal } from "@repo/ai";

import { createImageSuccessWebhookUrl } from "~/lib/create-base-url";
import { createClient } from "~/lib/supabase-client";
import { inngest } from "../_client/client";

export const handleCreateImage = inngest.createFunction(
  { id: "handle-create-image", name: "Handle Create Image" },
  { event: "media-server/handle-create-image" },
  async ({ event, step }) => {
    const { id, prompt } = event.data;

    const resource = await step.run("get-resource", async () => {
      const { data, error } = await createClient()
        .from("resource")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    });

    await step.run("update-resource-status-to-processing", async () => {
      await createClient()
        .from("resource")
        .update({ data: { prompt, status: "in_queue" } })
        .eq("id", id);
    });

    await step.run("generate-image-with-fal", async () => {
      const { id, prompt } = event.data;
      // Generate image with Fal
      const webhookUrl = createImageSuccessWebhookUrl({ id });
      await generateImageWithFal({
        prompt,
        webhookUrl,
        model: resource.engine,
        width: 1024,
        height: 1024,
        // Optionally pass FAL_KEY if needed by generateImageWithFal
      });
      // Update resource status to 'processing'
      await createClient()
        .from("resource")
        .update({ data: { prompt, status: "processing" } })
        .eq("id", id);
      return { id, status: "processing" };
    });
  },
);
