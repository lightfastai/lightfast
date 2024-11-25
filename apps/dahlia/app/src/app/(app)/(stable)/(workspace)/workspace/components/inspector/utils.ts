import { z } from "zod";

export const initDefaultMetadata = () => ({
  min: 0,
  max: 1,
  step: 0.1,
});

interface ValueFieldMetadata {
  min: number;
  max: number;
  step: number;
}

/**
 * Extracts the min and max values from a zod schema.
 * @param schema - The zod schema to extract the min and max values from.
 * @returns An object with min and max values.
 */
export const extractValueFieldMetadata = (
  schema: z.ZodTypeAny,
): ValueFieldMetadata => {
  // Recursively unwrap default, optional, and nullable schemas
  while (
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable
  ) {
    schema = schema._def.innerType as z.ZodTypeAny;
  }

  const metadata: ValueFieldMetadata = initDefaultMetadata();

  if (schema instanceof z.ZodNumber) {
    const checks = schema._def.checks;
    for (const check of checks) {
      if (check.kind === "min") {
        metadata.min = check.value;
      } else if (check.kind === "max") {
        metadata.max = check.value;
      } else if (check.kind === "int") {
        metadata.step = 1;
      }
    }
  }

  return metadata;
};

/**
 * Extracts the name of the uniform from the field name.
 * @param name - The name of the field.
 * @returns The name of the uniform.
 */
export const extractUniformName = (name: string) => {
  // remove u_ and replaced any _ with a space
  return name.replace("u_", "").replace(/_/g, " ");
};
