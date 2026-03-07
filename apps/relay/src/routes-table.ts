import { inspectRoutes } from "hono/dev";
import { printRouteTable } from "@vendor/observability/print-routes";
import app from "./app.js";
import { env } from "./env.js";

const routes = inspectRoutes(app)
  .filter((r) => !r.isMiddleware)
  .map(({ method, path }) => ({ method, path }));

printRouteTable(routes, { service: "relay", port: env.PORT });
