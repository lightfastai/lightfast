import { Hono } from "hono";
import { errorSanitizer } from "./middleware/error-sanitizer.js";
import { logger } from "./middleware/logger.js";
import { requestId } from "./middleware/request-id.js";
import { sentry } from "./middleware/sentry.js";
import { timing } from "./middleware/timing.js";
import { inngestRoute } from "./routes/inngest.js";
import { trigger } from "./routes/trigger.js";

const app = new Hono();

// Global middleware (order matters)
app.use(requestId);
app.use(logger);
app.use(sentry);
app.use(errorSanitizer);
app.use(timing);

// Health check
app.get("/", (c) => c.json({ service: "backfill", status: "ok" }));

// API routes
app.route("/api/trigger", trigger);
app.route("/api/inngest", inngestRoute);

export default app;
