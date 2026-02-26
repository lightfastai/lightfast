import { createEnv } from "@t3-oss/env-core";
import type { Context } from "hono";
import { env as honoEnv } from "hono/adapter";
import { z } from "zod";

/** Validated env from the Hono request context — use in route handlers. */
export const getEnv = (c: Context) =>
  createEnv({
    server: { GATEWAY_API_KEY: z.string().min(1) },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    runtimeEnv: honoEnv(c),
    emptyStringAsUndefined: true,
  });
