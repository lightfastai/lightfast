import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateOpenAPIDocument } from "./openapi-registry";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const doc = generateOpenAPIDocument();
const outputPath = resolve(__dirname, "../../../openapi.json");

writeFileSync(outputPath, JSON.stringify(doc, null, 2));
console.log(`OpenAPI spec written to ${outputPath}`);
