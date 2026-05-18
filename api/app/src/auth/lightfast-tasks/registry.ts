import { z } from "zod";

export const lightfastTaskKeySchema = z.enum(["connect-github"]);
export type LightfastTaskKey = z.infer<typeof lightfastTaskKeySchema>;

export interface LightfastTaskEntry {
  key: LightfastTaskKey;
  label: string;
  /** Default true. Optional tasks appear in the checklist but do not gate. */
  required?: boolean;
}

/**
 * Metadata-only registry. UI consumers read `label`/`required`. The
 * readiness resolver reads the required keys + diffs against cleared rows
 * in the DB. Each concrete task has its own tRPC mutation (no dispatch
 * table).
 */
export const LIGHTFAST_TASKS: readonly LightfastTaskEntry[] = [
  { key: "connect-github", label: "Connect GitHub" },
] as const;

/**
 * Derived helper for the readiness resolver — the keys that contribute to
 * the gate. Optional tasks (`required: false`) are excluded.
 */
export const LIGHTFAST_REQUIRED_TASK_KEYS: readonly string[] =
  LIGHTFAST_TASKS.filter((t) => t.required !== false).map((t) => t.key);
