import type { MethodInformation } from "fumadocs-openapi";

interface CodeSample {
  id: string;
  label: string;
  lang: string;
  source: string;
}

/**
 * Union of operationIds defined in packages/app-api-contract/src/contract.ts.
 * Must stay in sync with the OpenAPI spec — add/remove entries here when
 * endpoints are added/removed from the contract.
 */
type OperationId = "search" | "proxy.search" | "proxy.execute";

const sdkSamples: Record<OperationId, string> = {
  search: `import { Lightfast } from "lightfast";

const client = new Lightfast({ apiKey: "sk-lf-..." });

const results = await client.search({
  query: "authentication implementation",
  limit: 10,
  mode: "balanced",
  sources: ["github"],
});

console.log(results.results);
console.log(results.total);`,

  "proxy.search": `import { Lightfast } from "lightfast";

const client = new Lightfast({ apiKey: "sk-lf-..." });

const providers = await client.proxySearch();

for (const connection of providers.connections) {
  console.log(connection.provider);   // e.g., "github"
  console.log(connection.endpoints);  // Available API endpoints
}`,

  "proxy.execute": `import { Lightfast } from "lightfast";

const client = new Lightfast({ apiKey: "sk-lf-..." });

const result = await client.proxyExecute({
  installationId: "inst_abc123",
  endpointId: "list-pull-requests",
  pathParams: { owner: "myorg", repo: "myrepo" },
  queryParams: { state: "open" },
});

console.log(result.data);    // Raw provider API response
console.log(result.status);  // HTTP status code`,
};

const mcpSamples: Partial<Record<OperationId, string>> = {
  search: `{
  "name": "lightfast_search",
  "arguments": {
    "query": "how does authentication work",
    "limit": 5,
    "mode": "balanced",
    "sources": ["github"]
  }
}`,
};

function isOperationId(id: string): id is OperationId {
  return id in sdkSamples;
}

export function getCodeSamples(endpoint: MethodInformation): CodeSample[] {
  const operationId = endpoint.operationId;
  if (!(operationId && isOperationId(operationId))) {
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
