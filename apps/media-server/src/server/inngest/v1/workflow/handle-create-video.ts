import { generateVideoWithFal } from "@repo/ai";

import { createVideoSuccessWebhookUrl } from "../../../../lib/create-base-url";
import { supabase } from "../../../../lib/supabase-client";
import { inngest } from "../client";

export const handleCreateVideo = inngest.createFunction(
  { id: "handle-create-video", name: "Handle Create Video" },
  { event: "media-server/handle-create-video" },
  async ({ event, env, step }) => {
    const { id, prompt } = event.data;

    await step.run("update-resource-status-to-in-queue", async () => {
      await supabase({
        supabaseUrl: env.SUPABASE_URL,
        supabaseAnonKey: env.SUPABASE_ANON_KEY,
      })
        .from("resource")
        .update({ data: { prompt, status: "in_queue" } })
        .eq("id", id);
    });

    await step.run("generate-video-with-fal", async () => {
      const webhookUrl = createVideoSuccessWebhookUrl(env, { id });
      await generateVideoWithFal({ prompt, webhookUrl });
      await supabase({
        supabaseUrl: env.SUPABASE_URL,
        supabaseAnonKey: env.SUPABASE_ANON_KEY,
      })
        .from("resource")
        .update({ data: { prompt, status: "processing" } })
        .eq("id", id);
      return { id, status: "processing" };
    });
  },
);
