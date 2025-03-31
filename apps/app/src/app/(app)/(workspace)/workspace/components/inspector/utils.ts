import { z } from "zod";

import type { Vec2, Vec3 } from "@repo/webgl";

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

interface Vec1FieldMetadata {
  x: ValueFieldMetadata;
}

interface Vec2FieldMetadata {
  x: ValueFieldMetadata;
  y: ValueFieldMetadata;
}

interface Vec3FieldMetadata {
  x: ValueFieldMetadata;
  y: ValueFieldMetadata;
  z: ValueFieldMetadata;
}

/**
 * Extracts metadata for Vec1 fields from a zod schema.
 * @param schema - The zod schema to extract the Vec1 metadata from.
 * @returns An object with metadata for x component.
 */
export const extractValueFieldMetadata = (
  schema: z.ZodTypeAny,
): Vec1FieldMetadata => {
  // Recursively unwrap default, optional, and nullable schemas
  while (
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable
  ) {
    schema = schema._def.innerType as z.ZodTypeAny;
  }

  const defaultMetadata = initDefaultMetadata();
  const metadata: Vec1FieldMetadata = {
    x: { ...defaultMetadata },
  };

  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    let componentSchema = shape.x;

    // Unwrap default, optional, and nullable for component schema
    while (
      componentSchema instanceof z.ZodDefault ||
      componentSchema instanceof z.ZodOptional ||
      componentSchema instanceof z.ZodNullable
    ) {
      componentSchema = componentSchema._def.innerType as z.ZodTypeAny;
    }

    if (componentSchema instanceof z.ZodNumber) {
      const checks = componentSchema._def.checks;
      for (const check of checks) {
        if (check.kind === "min") {
          metadata.x.min = check.value;
        } else if (check.kind === "max") {
          metadata.x.max = check.value;
        } else if (check.kind === "int") {
          metadata.x.step = 1;
        }
      }
    }
  }

  return metadata;
};

/**
 * Extracts metadata for Vec2 fields from a zod schema.
 * @param schema - The zod schema to extract the Vec2 metadata from.
 * @returns An object with metadata for x and y components.
 */
export const extractVec2FieldMetadata = (
  schema: z.ZodTypeAny,
): Vec2FieldMetadata => {
  // Recursively unwrap default, optional, and nullable schemas
  while (
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable
  ) {
    schema = schema._def.innerType as z.ZodTypeAny;
  }

  const defaultMetadata = initDefaultMetadata();
  const metadata: Vec2FieldMetadata = {
    x: { ...defaultMetadata },
    y: { ...defaultMetadata },
  };

  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();

    // Extract metadata for each component (x, y)
    ["x", "y"].forEach((key) => {
      let componentSchema = shape[key];

      // Unwrap default, optional, and nullable for component schema
      while (
        componentSchema instanceof z.ZodDefault ||
        componentSchema instanceof z.ZodOptional ||
        componentSchema instanceof z.ZodNullable
      ) {
        componentSchema = componentSchema._def.innerType as z.ZodTypeAny;
      }

      if (componentSchema instanceof z.ZodNumber) {
        const checks = componentSchema._def.checks;
        for (const check of checks) {
          if (check.kind === "min") {
            metadata[key as keyof Vec2].min = check.value;
          } else if (check.kind === "max") {
            metadata[key as keyof Vec2].max = check.value;
          } else if (check.kind === "int") {
            metadata[key as keyof Vec2].step = 1;
          }
        }
      }
    });
  }

  return metadata;
};

/**
 * Extracts metadata for Vec3 fields from a zod schema.
 * @param schema - The zod schema to extract the Vec3 metadata from.
 * @returns An object with metadata for x, y, and z components.
 */
export const extractVec3FieldMetadata = (
  schema: z.ZodTypeAny,
): Vec3FieldMetadata => {
  // Recursively unwrap default, optional, and nullable schemas
  while (
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable
  ) {
    schema = schema._def.innerType as z.ZodTypeAny;
  }

  const defaultMetadata = initDefaultMetadata();
  const metadata: Vec3FieldMetadata = {
    x: { ...defaultMetadata },
    y: { ...defaultMetadata },
    z: { ...defaultMetadata },
  };

  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();

    // Extract metadata for each component (x, y, z)
    ["x", "y", "z"].forEach((key) => {
      let componentSchema = shape[key];

      // Unwrap default, optional, and nullable for component schema
      while (
        componentSchema instanceof z.ZodDefault ||
        componentSchema instanceof z.ZodOptional ||
        componentSchema instanceof z.ZodNullable
      ) {
        componentSchema = componentSchema._def.innerType as z.ZodTypeAny;
      }

      if (componentSchema instanceof z.ZodNumber) {
        const checks = componentSchema._def.checks;
        for (const check of checks) {
          if (check.kind === "min") {
            metadata[key as keyof Vec3].min = check.value;
          } else if (check.kind === "max") {
            metadata[key as keyof Vec3].max = check.value;
          } else if (check.kind === "int") {
            metadata[key as keyof Vec3].step = 1;
          }
        }
      }
    });
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
