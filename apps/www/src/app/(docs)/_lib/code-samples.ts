import type { MethodInformation } from "fumadocs-openapi";

interface CodeSample {
  id: string;
  label: string;
  lang: string;
  source: string;
}

/**
 * Union of operationIds defined in packages/app-openapi/src/registry.ts.
 * Must stay in sync with the OpenAPI spec — add/remove entries here when
 * endpoints are added/removed from the registry.
 */
type OperationId = "search" | "get-contents" | "find-similar" | "find-related";

const sdkSamples: Record<OperationId, string> = {
  search: `import { Lightfast } from "lightfast";

const client = new Lightfast({ apiKey: "sk-lf-..." });

const results = await client.search({
  query: "authentication implementation",
  limit: 10,
  mode: "balanced",
  filters: {
    sourceTypes: ["github"],
  },
});

console.log(results.data);
console.log(results.meta.total);`,

  "get-contents": `import { Lightfast } from "lightfast";

const client = new Lightfast({ apiKey: "sk-lf-..." });

const contents = await client.contents({
  ids: ["obs_abc123", "doc_def456"],
});

console.log(contents.items);
console.log(contents.missing);`,

  "find-similar": `import { Lightfast } from "lightfast";

const client = new Lightfast({ apiKey: "sk-lf-..." });

const similar = await client.findSimilar({
  url: "https://github.com/org/repo/pull/123",
  limit: 5,
  threshold: 0.7,
});

console.log(similar.similar);
console.log(similar.source);`,

  "find-related": `import { Lightfast } from "lightfast";

const client = new Lightfast({ apiKey: "sk-lf-..." });

const related = await client.related({
  id: "obs_abc123",
});

console.log(related.data.related);
console.log(related.data.bySource);
console.log(related.meta.total);`,
};

const mcpSamples: Record<OperationId, string> = {
  search: `{
  "name": "lightfast_search",
  "arguments": {
    "query": "how does authentication work",
    "limit": 5,
    "mode": "thorough",
    "filters": {
      "sourceTypes": ["github"]
    }
  }
}`,

  "get-contents": `{
  "name": "lightfast_contents",
  "arguments": {
    "ids": ["obs_abc123", "doc_def456"]
  }
}`,

  "find-similar": `{
  "name": "lightfast_find_similar",
  "arguments": {
    "url": "https://github.com/org/repo/pull/123",
    "limit": 5,
    "threshold": 0.7
  }
}`,

  "find-related": `{
  "name": "lightfast_related",
  "arguments": {
    "id": "obs_abc123"
  }
}`,
};

function isOperationId(id: string): id is OperationId {
  return id in sdkSamples;
}

export function getCodeSamples(endpoint: MethodInformation): CodeSample[] {
  const operationId = endpoint.operationId;
  if (!operationId || !isOperationId(operationId)) {
    return [];
  }

  const samples: CodeSample[] = [];

  if (sdkSamples[operationId]) {
    samples.push({
      id: "typescript-sdk",
      lang: "typescript",
      label: "TypeScript SDK",
      source: sdkSamples[operationId],
    });
  }

  if (mcpSamples[operationId]) {
    samples.push({
      id: "mcp-tool-call",
      lang: "json",
      label: "MCP Tool Call",
      source: mcpSamples[operationId],
    });
  }

  return samples;
}
