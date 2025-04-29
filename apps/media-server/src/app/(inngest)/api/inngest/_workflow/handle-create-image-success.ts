import { createClient } from "~/lib/supabase-client";
import { inngest } from "../_client/client";

export const handleResourceImageSuccess = inngest.createFunction(
  {
    id: "handle-resource-image-success",
    name: "Handle Resource Image Success",
  },
  { event: "media-server/resource-image-success" },
  async ({ event, step }) => {
    const { id, data } = event.data;

    const request = await step.run("get-resource", async () => {
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

    return step.run("update-resource-success", async () => {
      const { id } = event.data;
      const response = await createClient()
        .from("resource")
        .update({
          data: {
            // @todo fix...
            // @ts-expect-error
            ...(request.data as unknown),
            url: data.payload.images[0]?.url!,
            success_run_id: event.id,
          },
          status: "completed",
        })
        .eq("id", id)
        .select()
        .single();

      if (response.error) {
        throw new Error(response.error.message);
      }

      return { id, status: "success" };
    });
  },
);
