import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { apiContract } from "../src/contract";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function generate() {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const spec = await generator.generate(apiContract, {
    info: {
      title: "Lightfast API",
      version: "1.0.0-alpha",
      description:
        "Real-time semantic search across all your company's data sources. This API is currently in alpha — breaking changes may occur between releases.",
      contact: {
        name: "Lightfast Support",
        email: "support@lightfast.ai",
        url: "https://lightfast.ai",
      },
    },
    servers: [
      {
        url: "https://lightfast.ai",
        description: "Production API",
      },
    ],
    security: [{ apiKey: [] }],
    tags: [
      {
        name: "Search",
        description: "Semantic search across indexed content",
      },
    ],
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key",
          description:
            "Use your Lightfast API key (sk-lf-...) as the bearer token.",
        },
      },
    },
  });

  const outputPath = resolve(__dirname, "../openapi.json");
  writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  console.log(`OpenAPI spec written to ${outputPath}`);
}

generate();
