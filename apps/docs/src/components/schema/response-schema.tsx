import { getSchemaFields, type SchemaField } from "~/lib/schema-reader";
import { SSRCodeBlock } from "@repo/ui/components/ssr-code-block";

interface ResponseSchemaProps {
  /** OpenAPI schema name (e.g., "V1SearchResponse") */
  schema: string;
  /** Custom interface name to display */
  name?: string;
  /** Max depth for nested object expansion */
  depth?: number;
}

export async function ResponseSchema({
  schema,
  name,
  depth = 2,
}: ResponseSchemaProps) {
  const fields = getSchemaFields(schema);
  const displayName = name ?? schema;
  const code = renderInterface(displayName, fields, depth);

  return SSRCodeBlock({
    children: code,
    language: "typescript",
    className: "my-6",
  });
}

function renderInterface(
  name: string,
  fields: SchemaField[],
  depth: number,
  indent = 0
): string {
  const pad = "  ".repeat(indent);
  let out = `${pad}interface ${name} {\n`;

  for (const field of fields) {
    const optional = field.required ? "" : "?";

    if (field.children && field.children.length > 0 && depth > 0) {
      out += `${pad}  ${field.name}${optional}: {\n`;
      for (const child of field.children) {
        const childOpt = child.required ? "" : "?";
        out += `${pad}    ${child.name}${childOpt}: ${child.type};\n`;
      }
      out += `${pad}  };\n`;
    } else {
      out += `${pad}  ${field.name}${optional}: ${field.type};\n`;
    }
  }

  out += `${pad}}\n`;
  return out;
}
