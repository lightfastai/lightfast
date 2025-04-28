import { Hono } from "hono";
import { serve } from "inngest/hono";

import { inngest } from "../inngest/v1/client/client";
import { handleCreateImage } from "../inngest/v1/workflow/handle-create-image";
import { handleResourceImageSuccess } from "../inngest/v1/workflow/handle-create-image-success";
import { handleCreateVideo } from "../inngest/v1/workflow/handle-create-video";
import { handleResourceVideoSuccess } from "../inngest/v1/workflow/handle-create-video-success";
import healthRouter from "./health/index";

// Create a main router
const router = new Hono();

// Mount the health router
router.route("/health", healthRouter);
router.route("/healthz", healthRouter);

// Mount the resources router
// router.route("/resources", resourcesRouter);

// Mount the fal-proxy router
// router.route("/fal/proxy", falProxy);

// Mount Inngest handler at /api/inngest
router.on(
  ["GET", "PUT", "POST"],
  "/inngest",
  serve({
    client: inngest,
    functions: [
      handleCreateImage,
      handleResourceImageSuccess,
      handleCreateVideo,
      handleResourceVideoSuccess,
    ],
  }),
);

export default router;
