import { Hono } from "hono";
import { apiKeyAuth } from "../middleware/auth";

const connections = new Hono();

/**
 * GET /connections/:provider/authorize
 *
 * Initiate OAuth flow. Generates state token, stores in Redis, returns
 * authorization URL for the provider.
 *
 * Phase 5 implementation pending.
 */
connections.get("/:provider/authorize", (c) => {
  const provider = c.req.param("provider");

  return c.json(
    {
      status: "not_implemented",
      provider,
      message: "OAuth initiation will be implemented in Phase 5",
    },
    501,
  );
});

/**
 * GET /connections/:provider/callback
 *
 * OAuth callback. Validates state, exchanges code, triggers setup workflow.
 *
 * Phase 5 implementation pending.
 */
connections.get("/:provider/callback", (c) => {
  const provider = c.req.param("provider");

  return c.json(
    {
      status: "not_implemented",
      provider,
      message: "OAuth callback will be implemented in Phase 5",
    },
    501,
  );
});

/**
 * GET /connections/:id/token
 *
 * Token vault — returns decrypted provider token for a connection.
 * Requires X-API-Key authentication.
 *
 * Phase 5 implementation pending.
 */
connections.get("/:id/token", apiKeyAuth, (c) => {
  const id = c.req.param("id");

  return c.json(
    {
      status: "not_implemented",
      id,
      message: "Token vault will be implemented in Phase 5",
    },
    501,
  );
});

/**
 * GET /connections/:id
 *
 * Get connection status. Requires X-API-Key authentication.
 *
 * Phase 5 implementation pending.
 */
connections.get("/:id", apiKeyAuth, (c) => {
  const id = c.req.param("id");

  return c.json(
    {
      status: "not_implemented",
      id,
      message: "Connection status will be implemented in Phase 5",
    },
    501,
  );
});

/**
 * DELETE /connections/:provider/:id
 *
 * Teardown a connection. Requires X-API-Key authentication.
 *
 * Phase 5 implementation pending.
 */
connections.delete("/:provider/:id", apiKeyAuth, (c) => {
  const provider = c.req.param("provider");
  const id = c.req.param("id");

  return c.json(
    {
      status: "not_implemented",
      provider,
      id,
      message: "Connection teardown will be implemented in Phase 5",
    },
    501,
  );
});

/**
 * POST /connections/:id/resources
 *
 * Link resources to a connection. Requires X-API-Key authentication.
 *
 * Phase 5 implementation pending.
 */
connections.post("/:id/resources", apiKeyAuth, (c) => {
  const id = c.req.param("id");

  return c.json(
    {
      status: "not_implemented",
      id,
      message: "Resource linking will be implemented in Phase 5",
    },
    501,
  );
});

/**
 * DELETE /connections/:id/resources/:resourceId
 *
 * Unlink a resource from a connection. Requires X-API-Key authentication.
 *
 * Phase 5 implementation pending.
 */
connections.delete("/:id/resources/:resourceId", apiKeyAuth, (c) => {
  const id = c.req.param("id");
  const resourceId = c.req.param("resourceId");

  return c.json(
    {
      status: "not_implemented",
      id,
      resourceId,
      message: "Resource unlinking will be implemented in Phase 5",
    },
    501,
  );
});

export { connections };
