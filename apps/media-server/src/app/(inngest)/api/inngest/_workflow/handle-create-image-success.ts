import { getCloudflareContext } from "@opennextjs/cloudflare/cloudflare-context";

import { supabase } from "~/lib/supabase-client";
import { inngest } from "../_client/client";

export const handleResourceImageSuccess = inngest.createFunction(
  {
    id: "handle-resource-image-success",
    name: "Handle Resource Image Success",
  },
  { event: "media-server/resource-image-success" },
  async ({ event, step }) => {
    return step.run("update-resource-success", async () => {
      const { id, url } = event.data;
      await supabase({
        supabaseUrl: getCloudflareContext().env.SUPABASE_URL,
        supabaseAnonKey: getCloudflareContext().env.SUPABASE_ANON_KEY,
      })
        .from("resource")
        .update({ data: { url, status: "completed" } })
        .eq("id", id);
      return { id, status: "success", url };
    });
  },
);
