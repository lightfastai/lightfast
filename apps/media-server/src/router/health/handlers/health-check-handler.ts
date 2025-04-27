import type { Context } from "hono";

// Create the health check response handler
export const healthCheckHandler = (c: Context) => {
  return c.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
};
