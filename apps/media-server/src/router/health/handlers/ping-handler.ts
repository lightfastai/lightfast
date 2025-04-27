import type { Context } from "hono";

export const pingHandler = (c: Context) => {
  return c.json(
    {
      pong: true,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
    },
  );
};
