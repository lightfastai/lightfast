import { z } from "zod";

interface MinMax {
  min: number;
  max: number;
}

/**
 * Extracts the min and max values from a zod schema.
 * @param schema - The zod schema to extract the min and max values from.
 * @returns An object with min and max values.
 */
export const extractMinMax = (schema: z.ZodTypeAny): MinMax => {
  // Recursively unwrap default, optional, and nullable schemas
  while (
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable
  ) {
    schema = schema._def.innerType as z.ZodTypeAny;
  }

  const minMax: MinMax = {
    min: 0,
    max: 1,
  };

  if (schema instanceof z.ZodNumber) {
    const checks = schema._def.checks;
    for (const check of checks) {
      if (check.kind === "min") {
        minMax.min = check.value;
      } else if (check.kind === "max") {
        minMax.max = check.value;
      }
    }
  }

  return minMax;
};
