/**
 * Pre-configured internal tRPC caller for platform route handlers.
 *
 * Usage in route handlers:
 *   import { platform } from "@/lib/internal-caller";
 *   const result = await platform.webhooks.persistAndDispatch(input);
 */
import { createInternalCaller } from "@api/platform/internal";

export const platform = createInternalCaller("route");
