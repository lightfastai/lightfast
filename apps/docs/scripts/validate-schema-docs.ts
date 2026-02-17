#!/usr/bin/env tsx

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const openApiPath = resolve(
  __dirname,
  "../../../packages/console-openapi/openapi.json"
);
const sdkMdxPath = resolve(
  __dirname,
  "../src/content/api/sdks-tools/typescript-sdk.mdx"
);
const mcpMdxPath = resolve(
  __dirname,
  "../src/content/api/sdks-tools/mcp-server.mdx"
);

// 1. Load OpenAPI spec and extract schema names
const spec = JSON.parse(readFileSync(openApiPath, "utf-8")) as {
  components?: { schemas?: Record<string, unknown> };
};
const schemaNames = Object.keys(spec.components?.schemas ?? {});

console.log(`Found ${schemaNames.length} schemas in OpenAPI spec`);

// 2. Extract schema references from MDX files
const schemaRefPattern = /schema="([^"]+)"/g;
function extractSchemaRefs(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  return [...content.matchAll(schemaRefPattern)].map((m) => m[1]);
}

// 3. Validate all references exist in OpenAPI spec
const sdkRefs = extractSchemaRefs(sdkMdxPath);
const mcpRefs = extractSchemaRefs(mcpMdxPath);
const allRefs = [...new Set([...sdkRefs, ...mcpRefs])];

console.log(`Found ${sdkRefs.length} schema references in SDK docs`);
console.log(`Found ${mcpRefs.length} schema references in MCP docs`);
console.log(`Total unique schema references: ${allRefs.length}`);

let hasErrors = false;

for (const ref of allRefs) {
  if (!schemaNames.includes(ref)) {
    console.error(
      `ERROR: Schema "${ref}" referenced in docs but not found in OpenAPI spec`
    );
    hasErrors = true;
  }
}

// 4. Check all request schemas have documentation
const requestSchemas = schemaNames.filter((n) => n.includes("Request"));
const responseSchemas = schemaNames.filter((n) => n.includes("Response"));

console.log(
  `\nRequest schemas: ${requestSchemas.length} (${requestSchemas.join(", ")})`
);
console.log(
  `Response schemas: ${responseSchemas.length} (${responseSchemas.join(", ")})`
);

for (const schema of requestSchemas) {
  if (!allRefs.includes(schema)) {
    console.warn(
      `WARN: Schema "${schema}" exists in OpenAPI but not referenced in SDK/MCP docs`
    );
  }
}

if (hasErrors) {
  console.error("\n❌ Schema documentation validation failed");
  process.exit(1);
}

console.log("\n✓ All schema references valid");
