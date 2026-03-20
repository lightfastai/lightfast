import {
  ContentsRequestSchema,
  ContentsResponseSchema,
  FindSimilarRequestSchema,
  FindSimilarResponseSchema,
  RelatedRequestSchema,
  RelatedResponseSchema,
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
      { name: "Contents", description: "Batch content retrieval by ID" },
      {
        name: "Find Similar",
        description: "Find similar content using vector similarity",
      },
      { name: "Graph", description: "Relationship graph traversal" },
      { name: "Related", description: "Find related events by observation" },
    ],
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key",
          description:
            "Use your Lightfast API key (sk-lf-...) as the bearer token. Optionally include X-Workspace-ID header.",
        },
      },
      schemas: {
        SearchRequest: SearchRequestSchema,
        SearchResponse: SearchResponseSchema,
        ContentsRequest: ContentsRequestSchema,
        ContentsResponse: ContentsResponseSchema,
        FindSimilarRequest: FindSimilarRequestSchema,
        FindSimilarResponse: FindSimilarResponseSchema,
        RelatedRequest: RelatedRequestSchema,
        RelatedResponse: RelatedResponseSchema,
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
      "/v1/contents": {
        post: {
          tags: ["Contents"],
          operationId: "get-contents",
          summary: "Get Contents",
          description:
            "Fetch full content for specific documents or observations by their IDs. Batch endpoint supporting up to 50 IDs per request.",
          security: [{ apiKey: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: ContentsRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Content items",
              content: {
                "application/json": {
                  schema: ContentsResponseSchema,
                },
              },
            },
            "400": { description: "Invalid request parameters" },
            "401": { description: "Invalid or missing API key" },
            "500": { description: "Internal server error" },
          },
        },
      },
      "/v1/findsimilar": {
        post: {
          tags: ["Find Similar"],
          operationId: "find-similar",
          summary: "Find Similar",
          description:
            "Find content similar to a given document or URL using vector similarity, entity overlap, and cluster analysis.",
          security: [{ apiKey: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: FindSimilarRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Similar content items",
              content: {
                "application/json": {
                  schema: FindSimilarResponseSchema,
                },
              },
            },
            "400": { description: "Invalid request parameters" },
            "401": { description: "Invalid or missing API key" },
            "500": { description: "Internal server error" },
          },
        },
      },
      "/v1/related": {
        post: {
          tags: ["Related"],
          operationId: "find-related",
          summary: "Find Related Events",
          description:
            "Find events related to a specific observation, grouped by source and relationship type.",
          security: [{ apiKey: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: RelatedRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Related events",
              content: {
                "application/json": {
                  schema: RelatedResponseSchema,
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
