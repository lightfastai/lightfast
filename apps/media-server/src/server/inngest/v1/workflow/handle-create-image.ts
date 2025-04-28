import { generateImageWithFal } from "@repo/ai";

import { createImageSuccessWebhookUrl } from "../../../../lib/create-base-url";
import { supabase } from "../../../../lib/supabase-client";
import { inngest } from "../client";

export const handleCreateImage = inngest.createFunction(
  { id: "handle-create-image", name: "Handle Create Image" },
  { event: "media-server/handle-create-image" },
  async ({ event, env, step }) => {
    const { id, prompt } = event.data;

    await step.run("update-resource-status-to-processing", async () => {
      await supabase({
        supabaseUrl: env.SUPABASE_URL,
        supabaseAnonKey: env.SUPABASE_ANON_KEY,
      })
        .from("resource")
        .update({ data: { prompt, status: "in_queue" } })
        .eq("id", id);
    });

    await step.run("generate-image-with-fal", async () => {
      const { id, prompt } = event.data;
      const { SUPABASE_URL, SUPABASE_ANON_KEY } = env;
      // Generate image with Fal
      const webhookUrl = createImageSuccessWebhookUrl(env, { id });
      await generateImageWithFal({
        prompt,
        webhookUrl,
        // Optionally pass FAL_KEY if needed by generateImageWithFal
      });
      // Update resource status to 'processing'
      await supabase({
        supabaseUrl: SUPABASE_URL,
        supabaseAnonKey: SUPABASE_ANON_KEY,
      })
        .from("resource")
        .update({ data: { prompt, status: "processing" } })
        .eq("id", id);
      return { id, status: "processing" };
    });
  },
);
