import { createEnv } from "@t3-oss/env-core";

import { clientSchemaDefinition } from "./client-types";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    // Add your server-side (main process) environment variables here
    // Example: DATABASE_URL: z.string().url(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `VITE_PUBLIC_`.
   */
  clientPrefix: "VITE_PUBLIC_",
  // The keys here should match the actual variable names. `t3-oss/env-core` uses clientPrefix
  // internally to determine which variables belong to the client bundle.
  client: clientSchemaDefinition,

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    // Pass the *full* environment variable names here, including the prefix.
    VITE_PUBLIC_LIGHTFAST_API_URL: process.env.VITE_PUBLIC_LIGHTFAST_API_URL,
    // Ensure other client variables defined in clientSchemaDefinition are passed here too
    // e.g., VITE_PUBLIC_FEATURE_FLAG: process.env.VITE_PUBLIC_FEATURE_FLAG
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * We fix this behavior by passing an empty string value to Zod instead of
   * `undefined` when the variable is not found.
   * @link https://github.com/t3-oss/t3-env/issues/119
   */
  emptyStringAsUndefined: true,
});
