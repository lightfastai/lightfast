import { supabase } from "~/lib/supabase-client";
import { inngest } from "../client";

export const handleResourceVideoSuccess = inngest.createFunction(
  {
    id: "handle-resource-video-success",
    name: "Handle Resource Video Success",
  },
  { event: "media-server/resource-video-success" },
  async ({ event, env, step }) => {
    return step.run("update-resource-success", async () => {
      const { id, url } = event.data;
      await supabase({
        supabaseUrl: env.SUPABASE_URL,
        supabaseAnonKey: env.SUPABASE_ANON_KEY,
      })
        .from("resource")
        .update({ data: { url, status: "completed" } })
        .eq("id", id);
      return { id, status: "success", url };
    });
  },
);
