import type { Context } from "hono";

import type { CreateResourceSpecificInput } from "../schema/index.js";
import { inngest } from "~/inngest/client.js";
import { supabase } from "~/lib/supabase-client.js";

export async function handleVideoResource(c: Context) {
  const body = await c.req.json<CreateResourceSpecificInput>();
  const { id, prompt } = body;
  // Insert resource with status 'pending'
  const { data, error } = await supabase({
    supabaseUrl: c.env.SUPABASE_URL,
    supabaseAnonKey: c.env.SUPABASE_ANON_KEY,
  })
    .from("resource")
    .insert({
      id,
      data: { prompt },
      engine: "fal-ai/kling-video/v2/master/text-to-video",
      type: "video",
      status: "init",
    })
    .select()
    .single();
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  // Trigger Inngest workflow
  await inngest.send({
    name: "media-server/handle-create-video",
    data: { id, prompt },
  });

  return c.json({ id, status: "pending" });
}
