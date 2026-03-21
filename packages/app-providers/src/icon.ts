import { z } from "zod";

// ── SVG Icon Type ─────────────────────────────────────────────────────────────
// Lives here so both display.ts (client-safe leaf) and define.ts (server-only)
// can import it without either depending on the other.

/** Framework-agnostic SVG icon data — renderable by any UI layer */
export const iconDefSchema = z.object({
  d: z.string(),
  viewBox: z.string(),
});
export type IconDef = z.infer<typeof iconDefSchema>;
