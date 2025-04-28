import { supabase } from "../../../../lib/supabase-client";
import { inngest } from "../client";

export const handleResourceImageSuccess = inngest.createFunction(
  {
    id: "handle-resource-image-success",
    name: "Handle Resource Image Success",
  },
  { event: "media-server/resource-image-success" },
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
