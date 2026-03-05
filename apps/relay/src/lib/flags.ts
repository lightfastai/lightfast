import { evaluateFlag } from "@vendor/vercel-flags";
import type { SourceType } from "@repo/console-validation";

/**
 * Whether webhooks should be fanned out to Console.
 * Default: true (enabled) — preserves existing behavior when flags aren't configured.
 * Set to false in Vercel Dashboard to disable console delivery.
 * Supports per-provider targeting rules when provider context is provided.
 */
export async function isConsoleFanOutEnabled(
  provider?: SourceType,
): Promise<boolean> {
  const context = provider ? { webhook: { provider } } : undefined;
  try {
    return await evaluateFlag("console-fan-out", true, context);
  } catch {
    return true;
  }
}
