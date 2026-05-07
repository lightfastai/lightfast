import type { z } from "zod";

export const platformEvents = {} as const satisfies Record<
  string,
  z.ZodTypeAny
>;
