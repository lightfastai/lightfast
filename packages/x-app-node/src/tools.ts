import { z } from "zod";

import { XAppNodeError } from "./errors";

export interface XToolDefinition {
  description: string;
  inputSchema: Record<string, unknown>;
  name: string;
}

export interface ExecuteXApiToolInput {
  accessToken: string;
  apiOrigin: string;
  fetch?: typeof fetch;
  input?: Record<string, unknown>;
  name: string;
  signal?: AbortSignal;
}

export interface XApiToolResult {
  content: Array<{ text: string; type: "text" }>;
  structuredContent: unknown;
}

const objectSchema = z.record(z.string(), z.unknown()).optional();

export const X_TOOL_DEFINITIONS = [
  tool("getUsersMe", "Look up the connected X account.", {}),
  tool("getUsersByUsername", "Look up an X account by username.", {
    properties: { username: { type: "string" } },
    required: ["username"],
    type: "object",
  }),
  tool("getUsersByUsernames", "Look up multiple X accounts by username.", {
    properties: {
      usernames: { items: { type: "string" }, type: "array" },
    },
    required: ["usernames"],
    type: "object",
  }),
  tool("getUsersById", "Look up an X account by id.", {
    properties: { id: { type: "string" } },
    required: ["id"],
    type: "object",
  }),
  tool("getUsersByIds", "Look up multiple X accounts by id.", {
    properties: { ids: { items: { type: "string" }, type: "array" } },
    required: ["ids"],
    type: "object",
  }),
  tool("getPostsById", "Look up an X post by id.", {
    properties: { id: { type: "string" } },
    required: ["id"],
    type: "object",
  }),
  tool("getPostsByIds", "Look up multiple X posts by id.", {
    properties: { ids: { items: { type: "string" }, type: "array" } },
    required: ["ids"],
    type: "object",
  }),
  tool("searchPostsRecent", "Search recent X posts.", {
    properties: {
      max_results: { maximum: 100, minimum: 10, type: "number" },
      query: { type: "string" },
    },
    required: ["query"],
    type: "object",
  }),
  tool("getPostsCountsRecent", "Count recent X posts for a query.", {
    properties: { query: { type: "string" } },
    required: ["query"],
    type: "object",
  }),
] as const satisfies XToolDefinition[];

export async function executeXApiTool(
  input: ExecuteXApiToolInput
): Promise<XApiToolResult> {
  const requestFetch = input.fetch ?? fetch;
  const args = objectSchema.parse(input.input) ?? {};
  const url = xApiToolUrl({
    apiOrigin: input.apiOrigin,
    input: args,
    name: input.name,
  });

  try {
    const response = await requestFetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${input.accessToken}`,
      },
      method: "GET",
      signal: input.signal,
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || json === null) {
      throw new XAppNodeError("X_TOOL_CALL_FAILED", "X API tool call failed.");
    }

    return {
      content: [
        {
          text: `X tool ${input.name} completed.`,
          type: "text",
        },
      ],
      structuredContent: json,
    };
  } catch (error) {
    if (error instanceof XAppNodeError) {
      throw error;
    }
    throw new XAppNodeError(
      "X_TOOL_CALL_FAILED",
      "X API tool call failed.",
      error
    );
  }
}

export function getXToolDefinitions(): XToolDefinition[] {
  return [...X_TOOL_DEFINITIONS];
}

function tool(
  name: string,
  description: string,
  inputSchema: Record<string, unknown>
): XToolDefinition {
  return { description, inputSchema, name };
}

function xApiToolUrl(input: {
  apiOrigin: string;
  input: Record<string, unknown>;
  name: string;
}): string {
  const apiOrigin = input.apiOrigin.replace(/\/+$/, "");
  switch (input.name) {
    case "getUsersMe":
      return `${apiOrigin}/2/users/me`;
    case "getUsersByUsername":
      return `${apiOrigin}/2/users/by/username/${encodePath(stringArg(input.input, "username"))}`;
    case "getUsersByUsernames":
      return withQuery(`${apiOrigin}/2/users/by`, {
        usernames: listArg(input.input, "usernames").join(","),
      });
    case "getUsersById":
      return `${apiOrigin}/2/users/${encodePath(stringArg(input.input, "id"))}`;
    case "getUsersByIds":
      return withQuery(`${apiOrigin}/2/users`, {
        ids: listArg(input.input, "ids").join(","),
      });
    case "getPostsById":
      return `${apiOrigin}/2/tweets/${encodePath(stringArg(input.input, "id"))}`;
    case "getPostsByIds":
      return withQuery(`${apiOrigin}/2/tweets`, {
        ids: listArg(input.input, "ids").join(","),
      });
    case "searchPostsRecent":
      return withQuery(`${apiOrigin}/2/tweets/search/recent`, {
        max_results: numberArg(input.input, "max_results")?.toString(),
        query: stringArg(input.input, "query"),
      });
    case "getPostsCountsRecent":
      return withQuery(`${apiOrigin}/2/tweets/counts/recent`, {
        query: stringArg(input.input, "query"),
      });
    default:
      throw new XAppNodeError("X_TOOL_CALL_FAILED", "Unsupported X tool name.");
  }
}

function stringArg(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new XAppNodeError(
      "X_TOOL_CALL_FAILED",
      `X tool argument ${key} is required.`
    );
  }
  return value;
}

function numberArg(
  input: Record<string, unknown>,
  key: string
): number | undefined {
  const value = input[key];
  if (value === undefined) {
    return;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new XAppNodeError(
      "X_TOOL_CALL_FAILED",
      `X tool argument ${key} must be a number.`
    );
  }
  return value;
}

function listArg(input: Record<string, unknown>, key: string): string[] {
  const value = input[key];
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  throw new XAppNodeError(
    "X_TOOL_CALL_FAILED",
    `X tool argument ${key} is required.`
  );
}

function withQuery(
  baseUrl: string,
  params: Record<string, string | undefined>
): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function encodePath(value: string): string {
  return encodeURIComponent(value);
}
