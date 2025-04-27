import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { generateObject, nanoid, openai } from "@repo/ai/ai";

import { handleAudioResource } from "./handler/audio.js";
import { handleImageResource } from "./handler/image.js";
import { handleTextResource } from "./handler/text.js";
import { handleVideoResource } from "./handler/video.js";
import {
  createResourceSchema,
  createResourceSpecificSchema,
  generateResourceSchema,
} from "./schema/index.js";

// Create resources router
const resourcesRouter = new Hono();

// POST /api/resources/create - Create a new resource
resourcesRouter.post(
  "/create",
  zValidator("json", createResourceSchema),
  async (c) => {
    const body = c.req.valid("json");

    // we assign a unique id to the resource using nanoid and save to db.
    const id = nanoid();

    // use an ultra-fast ai to decide what kind of resource to create. we force run in a loop until we get a valid resource.
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      prompt: body.prompt,
      schema: generateResourceSchema,
    });

    // we send the prompt to a resource-specific router for generation. this means each resource type can handle it differently.
    // for example, an image might use a different prompt than a video.
    // we return the resource to the client which can download it.

    // call our resource-specific router for generation.
    const resource = await resourcesRouter.request(
      `/generate/${object.resourceType}`,
      {
        method: "POST",
        body: JSON.stringify({ prompt: body.prompt, id }),
      },
    );

    // if not 200, throw an error
    if (!resource.ok) {
      return c.json({ error: "Failed to generate resource" }, 500);
    }

    // we received the requestId from the resource-specific router.
    const { requestId } = (await resource.json()) as { requestId: string };

    // update db with requestId

    // return the resource to the client which can download it.
    return c.json({ id, requestId });
  },
);

// POST /api/resource/generate/image/success - A webhook that is called when a resource is generated
resourcesRouter.post("/generate/image/success", async (c) => {
  const body = await c.req.json();
  console.log("Image generated successfully", body);

  // update db with the updated image url

  return c.json({});
});

// POST /api/resources/generate - Generate a new resource
resourcesRouter.post(
  "/generate/image",
  zValidator("json", createResourceSpecificSchema),
  handleImageResource,
);

// POST /api/resources/generate/video - Generate a new video resource
resourcesRouter.post(
  "/generate/video",
  zValidator("json", createResourceSpecificSchema),
  handleVideoResource,
);

// POST /api/resources/generate/audio - Generate a new audio resource
resourcesRouter.post(
  "/generate/audio",
  zValidator("json", createResourceSpecificSchema),
  handleAudioResource,
);

// POST /api/resources/generate/text - Generate a new text resource
resourcesRouter.post(
  "/generate/text",
  zValidator("json", createResourceSpecificSchema),
  handleTextResource,
);

export default resourcesRouter;
