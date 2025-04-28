import { Hono } from "hono";
import { Bindings } from "hono/types";
import { validator as zValidator } from "hono/validator";

import { inngest } from "~/inngest/client/client";
import { handleImageResource } from "./handler/image";
import { handleVideoResource } from "./handler/video";
import { createResourceSpecificSchema } from "./schema";

// Create resources router
const resourcesRouter = new Hono<{ Bindings: Bindings }>();

// POST /api/resource/generate/image/success - A webhook that is called when a resource is generated
resourcesRouter.post("/generate/image/success", async (c) => {
  const { id } = c.req.query();
  const body = await c.req.json();

  // Validate fal.ai webhook payload
  const status = body.status;
  const imageUrl = body?.payload?.images?.[0]?.url;

  if (!id) {
    return c.json({ error: "Missing id" }, 400);
  }

  if (status !== "OK" || !imageUrl) {
    return c.json({ error: "Image generation failed or missing URL" }, 400);
  }

  // Emit Inngest event for DB update (success only)
  await inngest.send({
    name: "media-server/resource-image-success",
    data: { id, url: imageUrl },
  });

  return c.json(
    { message: "Resource update event queued", id, url: imageUrl },
    202,
  );
});

// POST /api/resource/generate/video/success - A webhook that is called when a video resource is generated
resourcesRouter.post("/generate/video/success", async (c) => {
  const { id } = c.req.query();
  const body = await c.req.json();

  // Validate fal.ai webhook payload
  const status = body.status;
  const videoUrl = body?.payload?.video?.url;

  if (!id) {
    return c.json({ error: "Missing id" }, 400);
  }

  if (status !== "OK" || !videoUrl) {
    return c.json({ error: "Video generation failed or missing URL" }, 400);
  }

  // Emit Inngest event for DB update (success only)
  await inngest.send({
    name: "media-server/resource-video-success",
    data: { id, url: videoUrl },
  });

  return c.json(
    { message: "Resource update event queued", id, url: videoUrl },
    202,
  );
});

// POST /api/resources/generate - Generate a new resource
resourcesRouter.post(
  "/generate/image",
  zValidator("json", (value, c) => createResourceSpecificSchema.parse(value)),
  handleImageResource,
);

// POST /api/resources/generate - Generate a new resource
resourcesRouter.post(
  "/generate/video",
  zValidator("json", (value, c) => createResourceSpecificSchema.parse(value)),
  handleVideoResource,
);

export default resourcesRouter;
