import { Hono } from "hono";

const webhooks = new Hono();

/**
 * POST /webhooks/:provider
 *
 * Receive webhooks from providers (GitHub, Vercel, Linear, Sentry).
 * Verifies signature, deduplicates, resolves connection, and delivers
 * to Console via QStash.
 *
 * Phase 2/3 implementation pending.
 */
webhooks.post("/:provider", (c) => {
  const provider = c.req.param("provider");

  return c.json(
    {
      status: "not_implemented",
      provider,
      message: "Webhook receipt will be implemented in Phase 3",
    },
    501,
  );
});

export { webhooks };
