/**
 * Pre-configured internal tRPC caller for Inngest functions.
 *
 * Import this in any Inngest function to call platform procedures:
 *
 *   import { platform } from "../platform";
 *   await step.run("get-token", () => platform.tokens.resolve(id));
 *
 * Module-level instantiation is safe because:
 * - createInternalCaller() is synchronous (no JWT, no async context)
 * - The caller is stateless — each procedure call creates its own middleware chain
 * - The auth context ({ type: "internal", source: "inngest" }) is static
 */
import { createInternalCaller } from "../internal";

export const platform = createInternalCaller("inngest");
