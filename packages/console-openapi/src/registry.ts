import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  V1SearchRequestSchema,
  V1SearchResponseSchema,
  V1ContentsRequestSchema,
  V1ContentsResponseSchema,
  V1FindSimilarRequestSchema,
  V1FindSimilarResponseSchema,
  V1GraphRequestSchema,
  GraphResponseSchema,
  V1RelatedRequestSchema,
  RelatedResponseSchema,
} from "@repo/console-types/api";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Register schemas
registry.register("V1SearchRequest", V1SearchRequestSchema);
registry.register("V1SearchResponse", V1SearchResponseSchema);
registry.register("V1ContentsRequest", V1ContentsRequestSchema);
registry.register("V1ContentsResponse", V1ContentsResponseSchema);
registry.register("V1FindSimilarRequest", V1FindSimilarRequestSchema);
registry.register("V1FindSimilarResponse", V1FindSimilarResponseSchema);
registry.register("V1GraphRequest", V1GraphRequestSchema);
registry.register("GraphResponse", GraphResponseSchema);
registry.register("V1RelatedRequest", V1RelatedRequestSchema);
registry.register("RelatedResponse", RelatedResponseSchema);

// Security scheme
registry.registerComponent("securitySchemes", "apiKey", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "API Key",
  description:
    "Use your Lightfast API key (sk-lf-...) as the bearer token. Optionally include X-Workspace-ID header.",
});

// POST /v1/search
registry.registerPath({
  method: "post",
  path: "/v1/search",
  tags: ["Search"],
  operationId: "search",
  summary: "Search",
  description:
    "Search across your team's knowledge with semantic understanding and multi-path retrieval.",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: V1SearchRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Search results",
      content: {
        "application/json": {
          schema: V1SearchResponseSchema,
        },
      },
    },
    400: { description: "Invalid request parameters" },
    401: { description: "Invalid or missing API key" },
    500: { description: "Internal server error" },
  },
});

// POST /v1/contents
registry.registerPath({
  method: "post",
  path: "/v1/contents",
  tags: ["Contents"],
  operationId: "get-contents",
  summary: "Get Contents",
  description:
    "Fetch full content for specific documents or observations by their IDs. Batch endpoint supporting up to 50 IDs per request.",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: V1ContentsRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Content items",
      content: {
        "application/json": {
          schema: V1ContentsResponseSchema,
        },
      },
    },
    400: { description: "Invalid request parameters" },
    401: { description: "Invalid or missing API key" },
    500: { description: "Internal server error" },
  },
});

// POST /v1/findsimilar
registry.registerPath({
  method: "post",
  path: "/v1/findsimilar",
  tags: ["Find Similar"],
  operationId: "find-similar",
  summary: "Find Similar",
  description:
    "Find content similar to a given document or URL using vector similarity, entity overlap, and cluster analysis.",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: V1FindSimilarRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Similar content items",
      content: {
        "application/json": {
          schema: V1FindSimilarResponseSchema,
        },
      },
    },
    400: { description: "Invalid request parameters" },
    401: { description: "Invalid or missing API key" },
    500: { description: "Internal server error" },
  },
});

// POST /v1/graph
registry.registerPath({
  method: "post",
  path: "/v1/graph",
  tags: ["Graph"],
  operationId: "graph",
  summary: "Relationship Graph",
  description:
    "Traverse the relationship graph starting from a specific observation. Returns connected nodes and edges with relationship metadata.",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: V1GraphRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Graph traversal results",
      content: {
        "application/json": {
          schema: GraphResponseSchema,
        },
      },
    },
    400: { description: "Invalid request parameters" },
    401: { description: "Invalid or missing API key" },
    500: { description: "Internal server error" },
  },
});

// POST /v1/related
registry.registerPath({
  method: "post",
  path: "/v1/related",
  tags: ["Related"],
  operationId: "find-related",
  summary: "Find Related Events",
  description:
    "Find events related to a specific observation, grouped by source and relationship type.",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: V1RelatedRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Related events",
      content: {
        "application/json": {
          schema: RelatedResponseSchema,
        },
      },
    },
    400: { description: "Invalid request parameters" },
    401: { description: "Invalid or missing API key" },
    500: { description: "Internal server error" },
  },
});

// Generator function
export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
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
  });
}
