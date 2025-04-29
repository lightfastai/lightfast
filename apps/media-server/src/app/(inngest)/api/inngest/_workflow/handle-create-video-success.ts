import { createClient } from "~/lib/supabase-client";
import { inngest } from "../_client/client";

export const handleResourceVideoSuccess = inngest.createFunction(
  {
    id: "handle-resource-video-success",
    name: "Handle Resource Video Success",
  },
  { event: "media-server/resource-video-success" },
  async ({ event, step }) => {
    return step.run("update-resource-success", async () => {
      const { id, url } = event.data;
      await createClient()
        .from("resource")
        .update({ data: { url, status: "completed" } })
        .eq("id", id);
      return { id, status: "success", url };
    });
  },
);
