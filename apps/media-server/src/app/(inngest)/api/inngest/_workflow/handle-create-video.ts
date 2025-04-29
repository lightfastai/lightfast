import { generateVideoWithFal } from "@repo/ai";

import { createVideoSuccessWebhookUrl } from "~/lib/base-url";
import { createClient } from "~/lib/supabase-client";
import { inngest } from "../_client/client";

export const handleCreateVideo = inngest.createFunction(
  { id: "handle-create-video", name: "Handle Create Video" },
  { event: "media-server/handle-create-video" },
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

    await step.run("update-resource-status-to-in-queue", async () => {
      await createClient()
        .from("resource")
        .update({ data: { prompt, status: "in_queue" } })
        .eq("id", id);
    });

    await step.run("generate-video-with-fal", async () => {
      const webhookUrl = createVideoSuccessWebhookUrl({ id });
      await generateVideoWithFal({
        prompt,
        webhookUrl,
        duration: 1,
        model: resource.engine,
      });
      await createClient()
        .from("resource")
        .update({ data: { prompt, status: "processing" } })
        .eq("id", id);
      return { id, status: "processing" };
    });
  },
);
