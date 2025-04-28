import { Hono } from "hono";
import { Bindings } from "hono/types";

import { createOpenAI } from "@repo/ai/ai";

import { getEnv } from "~/env/wrangler-env";

// Create resources router
const resourcesRouter = new Hono<{ Bindings: Bindings }>();

// POST /api/resource/generate/image/success - A webhook that is called when a resource is generated
resourcesRouter.get("/generate/image/success", async (c) => {
  // const body = await c.req.json();
  const { OPENAI_API_KEY } = getEnv(c);
  const openai = createOpenAI({
    apiKey: OPENAI_API_KEY,
  });

  // get the query params
  const { id } = c.req.query();

  // // update the resource with the image url
  // const { data, error } = await supabase
  //   .from("resource")
  //   .update({ url: body.url })
  //   .eq("id", id);

  return c.json(
    { message: "Resource generated successfully" },
    { status: 200 },
  );
});

// POST /api/resources/generate - Generate a new resource
// resourcesRouter.post(
//   "/generate/image",
//   zValidator("json", createResourceSpecificSchema),
//   handleImageResource,
// );

// // POST /api/resources/generate/video - Generate a new video resource
// resourcesRouter.post(
//   "/generate/video",
//   zValidator("json", createResourceSpecificSchema),
//   handleVideoResource,
// );

// // POST /api/resources/generate/audio - Generate a new audio resource
// resourcesRouter.post(
//   "/generate/audio",
//   zValidator("json", createResourceSpecificSchema),
//   handleAudioResource,
// );

export default resourcesRouter;
