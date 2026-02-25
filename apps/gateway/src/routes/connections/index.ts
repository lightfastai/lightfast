import { Hono } from "hono";
import type { TenantVariables } from "../../middleware/tenant";
import { oauth } from "./oauth";
import { resources } from "./resources";
import { lifecycle } from "./lifecycle";

const connections = new Hono<{ Variables: TenantVariables }>();

// Mount sub-routers — order matters for route matching
connections.route("/", oauth);      // /:provider/authorize, /:provider/callback
connections.route("/", lifecycle);  // /:id/token, /:id, /:provider/:id
connections.route("/", resources);  // /:id/resources, /:id/resources/:resourceId

export { connections };
