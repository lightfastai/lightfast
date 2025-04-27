import { Hono } from "hono";

import healthRouter from "./health/index.js";
import falProxy from "./proxy/fal.js";
import resourcesRouter from "./resources/index.js";

// Create a main router
const router = new Hono();

// Mount the health router
router.route("/health", healthRouter);
router.route("/healthz", healthRouter);

// Mount the resources router
router.route("/resources", resourcesRouter);

// Mount the fal-proxy router
router.route("/api/fal/proxy", falProxy);

export default router;
