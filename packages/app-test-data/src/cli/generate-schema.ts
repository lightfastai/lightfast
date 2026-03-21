#!/usr/bin/env npx tsx
/**
 * Generate webhook-schema.json from EVENT_REGISTRY (single source of truth).
 *
 * Usage:
 *   pnpm --filter @repo/app-test-data generate-schema
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProviderName } from "@repo/app-providers";
import { PROVIDERS } from "@repo/app-providers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, "../../datasets/webhook-schema.json");

const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  _generated:
    "AUTO-GENERATED from EVENT_REGISTRY. Do not edit manually. Run: pnpm --filter @repo/app-test-data generate-schema",
  title: "Webhook Test Dataset",
  description:
    "Test dataset containing raw webhook payloads that flow through production transformers",
  type: "object",
  required: ["name", "webhooks"],
  additionalProperties: false,
  properties: {
    $schema: {
      type: "string",
      description: "JSON Schema reference",
    },
    name: {
      type: "string",
      description: "Dataset identifier",
    },
    description: {
      type: "string",
      description: "Dataset purpose",
    },
    webhooks: {
      type: "array",
      items: { $ref: "#/definitions/WebhookPayload" },
      minItems: 1,
    },
  },
  definitions: {
    WebhookPayload: {
      type: "object",
      required: ["source", "eventType", "payload"],
      additionalProperties: false,
      properties: {
        source: {
          type: "string",
          enum: Object.keys(PROVIDERS),
          description: "Webhook source platform",
        },
        eventType: {
          type: "string",
          description:
            "Event type identifier (auto-derived from EVENT_REGISTRY)",
          oneOf: (Object.keys(PROVIDERS) as ProviderName[]).map((key) => ({
            enum: Object.keys(PROVIDERS[key].categories),
            description: `${PROVIDERS[key].displayName} event types`,
          })),
        },
        payload: {
          type: "object",
          description:
            "Raw webhook payload matching the source platform's webhook format",
        },
      },
    },
  },
};

writeFileSync(outputPath, `${JSON.stringify(schema, null, 2)}\n`);
console.log(`Generated: ${outputPath}`);
