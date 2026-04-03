import {
  SearchRequestSchema,
  SearchResponseSchema,
} from "@repo/app-validation/api";
import { createDocument } from "zod-openapi";

export function generateOpenAPIDocument(): ReturnType<typeof createDocument> {
  return createDocument({
    openapi: "3.1.0",
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
      { name: "Search", description: "Semantic search across indexed content" },
      { name: "Graph", description: "Relationship graph traversal" },
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
      schemas: {
        SearchRequest: SearchRequestSchema,
        SearchResponse: SearchResponseSchema,
      },
    },
    paths: {
      "/v1/search": {
        post: {
          tags: ["Search"],
          operationId: "search",
          summary: "Search",
          description:
            "Search across your team's knowledge with semantic understanding and multi-path retrieval.",
          security: [{ apiKey: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: SearchRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Search results",
              content: {
                "application/json": {
                  schema: SearchResponseSchema,
                },
              },
            },
            "400": { description: "Invalid request parameters" },
            "401": { description: "Invalid or missing API key" },
            "500": { description: "Internal server error" },
          },
        },
      },
    },
  });
}
