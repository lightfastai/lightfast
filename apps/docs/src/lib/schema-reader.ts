import openApiSpec from "../../../../packages/console-openapi/openapi.json";

export interface SchemaField {
  name: string;
  type: string; // Human-readable type string
  required: boolean;
  default?: unknown;
  description?: string;
  constraints?: string; // e.g. "1-100", "min: 0, max: 1"
  enum?: string[];
  children?: SchemaField[]; // For nested objects
}

interface OpenAPIProperty {
  type?: string | string[]; // Can be array of types in OpenAPI 3.1
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  nullable?: boolean;
  oneOf?: OpenAPIProperty[];
  items?: OpenAPIProperty;
  properties?: Record<string, OpenAPIProperty>;
  required?: string[];
}

interface OpenAPISchema {
  type?: string;
  properties?: Record<string, OpenAPIProperty>;
  required?: string[];
}

/**
 * Extract schema fields from OpenAPI component schema.
 * Handles: primitives, enums, arrays, nested objects.
 */
export function getSchemaFields(schemaName: string): SchemaField[] {
  const schemas = openApiSpec.components?.schemas as
    | Record<string, OpenAPISchema>
    | undefined;
  const schema = schemas?.[schemaName];

  if (!schema) {
    throw new Error(`Schema "${schemaName}" not found in OpenAPI spec`);
  }

  return parseSchemaProperties(schema);
}

/**
 * Parse OpenAPI schema properties into SchemaField array.
 */
function parseSchemaProperties(schema: OpenAPISchema): SchemaField[] {
  if (!schema.properties) {
    return [];
  }

  const requiredFields = schema.required ?? [];
  const fields: SchemaField[] = [];

  for (const [name, prop] of Object.entries(schema.properties)) {
    const field: SchemaField = {
      name,
      type: resolveType(prop),
      required: requiredFields.includes(name),
    };

    if (prop.description) {
      field.description = prop.description;
    }

    if (prop.default !== undefined) {
      field.default = prop.default;
    }

    if (prop.enum) {
      field.enum = prop.enum.map((v) => String(v));
    }

    const constraints = parseConstraints(prop);
    if (constraints) {
      field.constraints = constraints;
    }

    // Parse nested object properties
    if (prop.type === "object" && prop.properties) {
      field.children = parseSchemaProperties({
        type: "object",
        properties: prop.properties,
        required: prop.required,
      });
    }

    fields.push(field);
  }

  return fields;
}

/**
 * Get human-readable type string from OpenAPI schema property.
 */
function resolveType(prop: OpenAPIProperty): string {
  // Handle array of types (OpenAPI 3.1 union types)
  if (Array.isArray(prop.type)) {
    return prop.type.join(" | ");
  }

  // Handle arrays
  if (prop.type === "array" && prop.items) {
    const itemType = resolveType(prop.items);
    return `${itemType}[]`;
  }

  // Handle enums
  if (prop.enum) {
    return prop.enum.map((v) => `"${v}"`).join(" | ");
  }

  // Handle nullable
  if (prop.nullable && prop.type) {
    return `${prop.type} | null`;
  }

  // Handle oneOf (nullable in OpenAPI 3.1)
  if (prop.oneOf && prop.oneOf.length > 0) {
    const types = prop.oneOf.map((s) => {
      if (Array.isArray(s.type)) {
        return s.type.join(" | ");
      }
      return s.type || resolveType(s);
    });
    return types.join(" | ");
  }

  // Handle object type
  if (prop.type === "object") {
    return "object";
  }

  return prop.type ?? "unknown";
}

/**
 * Parse validation constraints into human-readable string.
 */
function parseConstraints(prop: OpenAPIProperty): string | undefined {
  const parts: string[] = [];

  if (prop.minimum !== undefined) parts.push(`min: ${prop.minimum}`);
  if (prop.maximum !== undefined) parts.push(`max: ${prop.maximum}`);
  if (prop.minItems !== undefined) parts.push(`min items: ${prop.minItems}`);
  if (prop.maxItems !== undefined) parts.push(`max items: ${prop.maxItems}`);
  if (prop.minLength !== undefined)
    parts.push(`min length: ${prop.minLength}`);
  if (prop.maxLength !== undefined)
    parts.push(`max length: ${prop.maxLength}`);

  return parts.length > 0 ? parts.join(", ") : undefined;
}
