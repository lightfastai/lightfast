import type { MethodInformation } from "fumadocs-openapi";

interface CodeSample {
  id: string;
  label: string;
  lang: string;
  source: string;
}

/**
 * Union of operationIds defined in packages/api-contract/src/contract.ts.
 * Must stay in sync with the OpenAPI spec — add/remove entries here when
 * endpoints are added/removed from the contract.
 */
type OperationId = "search";

const sdkSamples: Record<OperationId, string> = {
  search: `import { Lightfast } from "lightfast";

const client = new Lightfast({ apiKey: "ak_..." });

const results = await client.search({
  query: "authentication implementation",
  limit: 10,
  mode: "balanced",
});

console.log(results.results);
console.log(results.total);`,
};

const mcpSamples: Partial<Record<OperationId, string>> = {
  search: `{
  "name": "lightfast_search",
  "arguments": {
    "query": "how does authentication work",
    "limit": 5,
    "mode": "balanced"
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
