import { generateImageWithFal } from "@repo/ai";

import { createImageSuccessWebhookUrl } from "~/lib/base-url";
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
      const { data, error } = await createClient()
        .from("resource")
        .update({
          data: {
            prompt,
            inngestEventId: event.id,
          },
          status: "in_queue",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    });

    await step.run("generate-image-with-fal", async () => {
      const { id, prompt } = event.data;
      // Generate image with Fal
      const webhookUrl = createImageSuccessWebhookUrl({ id });
      console.log("webhookUrl", webhookUrl);
      const result = await generateImageWithFal({
        prompt,
        webhookUrl,
        model: resource.engine,
        width: 1024,
        height: 1024,
      });

      const { request_id } = result;

      // Update resource status to 'processing' and store request_id
      await createClient()
        .from("resource")
        .update({
          data: {
            prompt,
            fal_request_id: request_id,
            inngest_event_id: event.id,
          },
          status: "processing",
        })
        .eq("id", id);

      return { id, status: "processing", request_id };
    });
  },
);
