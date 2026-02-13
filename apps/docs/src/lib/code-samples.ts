import type { MethodInformation } from "fumadocs-openapi";

interface CodeSample {
  id: string;
  lang: string;
  label: string;
  source: string;
}

const sdkSamples: Record<string, string> = {
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

  graph: `import { Lightfast } from "lightfast";

const client = new Lightfast({ apiKey: "sk-lf-..." });

const graph = await client.graph({
  id: "obs_abc123",
  depth: 2,
});

console.log(graph.data.nodes);
console.log(graph.data.edges);
console.log(graph.meta.nodeCount);`,

  "find-related": `import { Lightfast } from "lightfast";

const client = new Lightfast({ apiKey: "sk-lf-..." });

const related = await client.related({
  id: "obs_abc123",
});

console.log(related.data.related);
console.log(related.data.bySource);
console.log(related.meta.total);`,
};

const mcpSamples: Record<string, string> = {
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

  graph: `{
  "name": "lightfast_graph",
  "arguments": {
    "id": "obs_abc123",
    "depth": 2
  }
}`,

  "find-related": `{
  "name": "lightfast_related",
  "arguments": {
    "id": "obs_abc123"
  }
}`,
};

export function getCodeSamples(endpoint: MethodInformation): CodeSample[] {
  const operationId = endpoint.operationId;
  if (!operationId) return [];

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
