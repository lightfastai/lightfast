import type { XToolDefinition } from "./tools";
import { XAppNodeError } from "./errors";

export type XOperationMethod = "DELETE" | "GET" | "POST" | "PUT";
export type XOperationClassification = "read" | "write";

export interface XOperationDefinition {
  body?: (input: Record<string, unknown>) => unknown;
  classification: XOperationClassification;
  description: string;
  inputSchema: Record<string, unknown>;
  method: XOperationMethod;
  name: string;
  path: string;
  pathParams?: (
    input: Record<string, unknown>,
    connectedActorId?: string | null
  ) => Record<string, string>;
  query?: (input: Record<string, unknown>) => Record<string, string | undefined>;
  requiredScopes: string[];
  sourceUserId?: "connected_actor";
}

export interface XOperationRequest {
  body?: string;
  headers: Record<string, string>;
  method: XOperationMethod;
  url: string;
}

const objectSchema = {
  type: "object",
} as const;

const emptySchema = {} as const;

function schema(
  properties: Record<string, Record<string, unknown>>,
  required: string[] = []
) {
  return {
    properties,
    ...(required.length > 0 ? { required } : {}),
    type: "object",
  };
}

function bodyFromInput(input: Record<string, unknown>) {
  return input;
}

function omitBody(...keys: string[]) {
  return (input: Record<string, unknown>) => {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (!keys.includes(key)) {
        body[key] = value;
      }
    }
    return body;
  };
}

function pickBody(...keys: string[]) {
  return (input: Record<string, unknown>) => {
    const body: Record<string, unknown> = {};
    for (const key of keys) {
      body[key] = stringArg(input, key);
    }
    return body;
  };
}

function hiddenReplyBody(input: Record<string, unknown>) {
  return { hidden: input.hidden ?? true };
}

function queryValues(...keys: string[]) {
  return (input: Record<string, unknown>) =>
    Object.fromEntries(
      keys.map((key) => {
        const value = input[key];
        if (value === undefined) {
          return [key, undefined];
        }
        if (Array.isArray(value)) {
          return [key, value.map((item) => String(item)).join(",")];
        }
        return [key, String(value)];
      })
    );
}

function standardPathParams(
  input: Record<string, unknown>,
  connectedActorId?: string | null
) {
  return {
    ...Object.fromEntries(
      Object.entries(input)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value])
    ),
    ...(connectedActorId ? { source_user_id: connectedActorId } : {}),
  };
}

const readOperations: XOperationDefinition[] = [
  {
    classification: "read",
    description: "Look up the connected X account.",
    inputSchema: emptySchema,
    method: "GET",
    name: "getUsersMe",
    path: "/2/users/me",
    requiredScopes: ["users.read"],
  },
  {
    classification: "read",
    description: "Look up an X account by username.",
    inputSchema: schema({ username: { type: "string" } }, ["username"]),
    method: "GET",
    name: "getUsersByUsername",
    path: "/2/users/by/username/{username}",
    requiredScopes: ["users.read"],
  },
  {
    classification: "read",
    description: "Look up multiple X accounts by username.",
    inputSchema: schema(
      { usernames: { items: { type: "string" }, type: "array" } },
      ["usernames"]
    ),
    method: "GET",
    name: "getUsersByUsernames",
    path: "/2/users/by",
    query: queryValues("usernames"),
    requiredScopes: ["users.read"],
  },
  {
    classification: "read",
    description: "Look up an X account by id.",
    inputSchema: schema({ id: { type: "string" } }, ["id"]),
    method: "GET",
    name: "getUsersById",
    path: "/2/users/{id}",
    requiredScopes: ["users.read"],
  },
  {
    classification: "read",
    description: "Look up multiple X accounts by id.",
    inputSchema: schema(
      { ids: { items: { type: "string" }, type: "array" } },
      ["ids"]
    ),
    method: "GET",
    name: "getUsersByIds",
    path: "/2/users",
    query: queryValues("ids"),
    requiredScopes: ["users.read"],
  },
  {
    classification: "read",
    description: "Look up an X post by id.",
    inputSchema: schema({ id: { type: "string" } }, ["id"]),
    method: "GET",
    name: "getPostsById",
    path: "/2/tweets/{id}",
    requiredScopes: ["tweet.read", "users.read"],
  },
  {
    classification: "read",
    description: "Look up multiple X posts by id.",
    inputSchema: schema(
      { ids: { items: { type: "string" }, type: "array" } },
      ["ids"]
    ),
    method: "GET",
    name: "getPostsByIds",
    path: "/2/tweets",
    query: queryValues("ids"),
    requiredScopes: ["tweet.read", "users.read"],
  },
  {
    classification: "read",
    description: "Search recent X posts.",
    inputSchema: schema(
      {
        max_results: { maximum: 100, minimum: 10, type: "number" },
        query: { type: "string" },
      },
      ["query"]
    ),
    method: "GET",
    name: "searchPostsRecent",
    path: "/2/tweets/search/recent",
    query: queryValues("query", "max_results"),
    requiredScopes: ["tweet.read", "users.read"],
  },
  {
    classification: "read",
    description: "Count recent X posts for a query.",
    inputSchema: schema({ query: { type: "string" } }, ["query"]),
    method: "GET",
    name: "getPostsCountsRecent",
    path: "/2/tweets/counts/recent",
    query: queryValues("query"),
    requiredScopes: ["tweet.read", "users.read"],
  },
];

const writeOperations: XOperationDefinition[] = [
  write("createPost", "Create an X post.", "/2/tweets", [
    "tweet.read",
    "tweet.write",
    "users.read",
  ]),
  write("deletePost", "Delete an X post.", "/2/tweets/{id}", [
    "tweet.read",
    "tweet.write",
    "users.read",
  ], {
    body: undefined,
    inputSchema: schema({ id: { type: "string" } }, ["id"]),
    method: "DELETE",
  }),
  sourceWrite("repostPost", "Repost an X post.", "/2/users/{source_user_id}/retweets", [
    "tweet.read",
    "tweet.write",
    "users.read",
  ], {
    body: pickBody("tweet_id"),
    inputSchema: schema({ tweet_id: { type: "string" } }, ["tweet_id"]),
  }),
  sourceWrite(
    "unrepostPost",
    "Remove a repost.",
    "/2/users/{source_user_id}/retweets/{source_tweet_id}",
    ["tweet.read", "tweet.write", "users.read"],
    {
      inputSchema: schema({ tweet_id: { type: "string" } }, ["tweet_id"]),
      method: "DELETE",
      pathParams: (input, connectedActorId) => ({
        source_tweet_id: stringArg(input, "tweet_id"),
        source_user_id: connectedActorId ?? "",
      }),
    }
  ),
  write("hideReply", "Hide or unhide a reply.", "/2/tweets/{tweet_id}/hidden", [
    "tweet.moderate.write",
    "tweet.read",
    "users.read",
  ], {
    body: hiddenReplyBody,
    inputSchema: schema(
      { hidden: { type: "boolean" }, tweet_id: { type: "string" } },
      ["tweet_id"]
    ),
    method: "PUT",
  }),
  sourceWrite("likePost", "Like an X post.", "/2/users/{source_user_id}/likes", [
    "like.write",
    "tweet.read",
    "users.read",
  ], {
    body: pickBody("tweet_id"),
    inputSchema: schema({ tweet_id: { type: "string" } }, ["tweet_id"]),
  }),
  sourceWrite(
    "unlikePost",
    "Remove a like from an X post.",
    "/2/users/{source_user_id}/likes/{tweet_id}",
    ["like.write", "tweet.read", "users.read"],
    {
      inputSchema: schema({ tweet_id: { type: "string" } }, ["tweet_id"]),
      method: "DELETE",
    }
  ),
  sourceWrite("createBookmark", "Bookmark an X post.", "/2/users/{source_user_id}/bookmarks", [
    "bookmark.write",
    "tweet.read",
    "users.read",
  ], {
    body: pickBody("tweet_id"),
    inputSchema: schema({ tweet_id: { type: "string" } }, ["tweet_id"]),
  }),
  sourceWrite(
    "deleteBookmark",
    "Remove an X bookmark.",
    "/2/users/{source_user_id}/bookmarks/{tweet_id}",
    ["bookmark.write", "tweet.read", "users.read"],
    {
      inputSchema: schema({ tweet_id: { type: "string" } }, ["tweet_id"]),
      method: "DELETE",
    }
  ),
  sourceWrite("followUser", "Follow an X user.", "/2/users/{source_user_id}/following", [
    "follows.write",
    "tweet.read",
    "users.read",
  ], {
    body: pickBody("target_user_id"),
    inputSchema: schema(
      { target_user_id: { type: "string" } },
      ["target_user_id"]
    ),
  }),
  sourceWrite(
    "unfollowUser",
    "Unfollow an X user.",
    "/2/users/{source_user_id}/following/{target_user_id}",
    ["follows.write", "tweet.read", "users.read"],
    {
      inputSchema: schema(
        { target_user_id: { type: "string" } },
        ["target_user_id"]
      ),
      method: "DELETE",
    }
  ),
  sourceWrite("muteUser", "Mute an X user.", "/2/users/{source_user_id}/muting", [
    "mute.write",
    "tweet.read",
    "users.read",
  ], {
    body: pickBody("target_user_id"),
    inputSchema: schema(
      { target_user_id: { type: "string" } },
      ["target_user_id"]
    ),
  }),
  sourceWrite(
    "unmuteUser",
    "Unmute an X user.",
    "/2/users/{source_user_id}/muting/{target_user_id}",
    ["mute.write", "tweet.read", "users.read"],
    {
      inputSchema: schema(
        { target_user_id: { type: "string" } },
        ["target_user_id"]
      ),
      method: "DELETE",
    }
  ),
  sourceWrite("blockUser", "Block an X user.", "/2/users/{source_user_id}/blocking", [
    "block.write",
    "users.read",
  ], {
    body: pickBody("target_user_id"),
    inputSchema: schema(
      { target_user_id: { type: "string" } },
      ["target_user_id"]
    ),
  }),
  sourceWrite(
    "unblockUser",
    "Unblock an X user.",
    "/2/users/{source_user_id}/blocking/{target_user_id}",
    ["block.write", "users.read"],
    {
      inputSchema: schema(
        { target_user_id: { type: "string" } },
        ["target_user_id"]
      ),
      method: "DELETE",
    }
  ),
  write("blockDms", "Block DMs from an X user.", "/2/users/{user_id}/dm/block", [
    "dm.write",
    "tweet.read",
    "users.read",
  ], {
    body: undefined,
    inputSchema: schema({ user_id: { type: "string" } }, ["user_id"]),
  }),
  write("unblockDms", "Unblock DMs from an X user.", "/2/users/{user_id}/dm/unblock", [
    "dm.write",
    "tweet.read",
    "users.read",
  ], {
    body: undefined,
    inputSchema: schema({ user_id: { type: "string" } }, ["user_id"]),
  }),
  write("createList", "Create an X list.", "/2/lists", [
    "list.read",
    "list.write",
    "tweet.read",
    "users.read",
  ]),
  write("updateList", "Update an X list.", "/2/lists/{id}", [
    "list.write",
    "tweet.read",
    "users.read",
  ], {
    body: omitBody("id"),
    inputSchema: schema({ id: { type: "string" } }, ["id"]),
    method: "PUT",
  }),
  write("deleteList", "Delete an X list.", "/2/lists/{id}", [
    "list.write",
    "tweet.read",
    "users.read",
  ], {
    body: undefined,
    inputSchema: schema({ id: { type: "string" } }, ["id"]),
    method: "DELETE",
  }),
  write("addListMember", "Add a member to an X list.", "/2/lists/{id}/members", [
    "list.write",
    "tweet.read",
    "users.read",
  ], {
    body: pickBody("user_id"),
    inputSchema: schema(
      { id: { type: "string" }, user_id: { type: "string" } },
      ["id", "user_id"]
    ),
  }),
  write(
    "removeListMember",
    "Remove a member from an X list.",
    "/2/lists/{id}/members/{user_id}",
    ["list.write", "tweet.read", "users.read"],
    {
      body: undefined,
      inputSchema: schema(
        { id: { type: "string" }, user_id: { type: "string" } },
        ["id", "user_id"]
      ),
      method: "DELETE",
    }
  ),
  sourceWrite("followList", "Follow an X list.", "/2/users/{source_user_id}/followed_lists", [
    "list.write",
    "tweet.read",
    "users.read",
  ], {
    body: pickBody("list_id"),
    inputSchema: schema({ list_id: { type: "string" } }, ["list_id"]),
  }),
  sourceWrite(
    "unfollowList",
    "Unfollow an X list.",
    "/2/users/{source_user_id}/followed_lists/{list_id}",
    ["list.write", "tweet.read", "users.read"],
    {
      inputSchema: schema({ list_id: { type: "string" } }, ["list_id"]),
      method: "DELETE",
    }
  ),
  sourceWrite("pinList", "Pin an X list.", "/2/users/{source_user_id}/pinned_lists", [
    "list.write",
    "tweet.read",
    "users.read",
  ], {
    body: pickBody("list_id"),
    inputSchema: schema({ list_id: { type: "string" } }, ["list_id"]),
  }),
  sourceWrite(
    "unpinList",
    "Unpin an X list.",
    "/2/users/{source_user_id}/pinned_lists/{list_id}",
    ["list.write", "tweet.read", "users.read"],
    {
      inputSchema: schema({ list_id: { type: "string" } }, ["list_id"]),
      method: "DELETE",
    }
  ),
  write("createDmConversation", "Create an X DM conversation.", "/2/dm_conversations", [
    "dm.write",
    "tweet.read",
    "users.read",
  ]),
  write(
    "sendDmByParticipant",
    "Send an X DM by participant id.",
    "/2/dm_conversations/with/{participant_id}/messages",
    ["dm.write", "tweet.read", "users.read"],
    {
      body: omitBody("participant_id"),
      inputSchema: schema(
        { participant_id: { type: "string" } },
        ["participant_id"]
      ),
    }
  ),
  write(
    "sendDmByConversation",
    "Send an X DM by conversation id.",
    "/2/dm_conversations/{dm_conversation_id}/messages",
    ["dm.write", "tweet.read", "users.read"],
    {
      body: omitBody("dm_conversation_id"),
      inputSchema: schema(
        { dm_conversation_id: { type: "string" } },
        ["dm_conversation_id"]
      ),
    }
  ),
  write("deleteDmEvent", "Delete an X DM event.", "/2/dm_events/{event_id}", [
    "dm.read",
    "dm.write",
  ], {
    body: undefined,
    inputSchema: schema({ event_id: { type: "string" } }, ["event_id"]),
    method: "DELETE",
  }),
  write("createChatConversation", "Create an X chat group conversation.", "/2/chat/conversations/group", [
    "dm.write",
    "tweet.read",
    "users.read",
  ]),
  write("initializeChatGroup", "Initialize an X chat group.", "/2/chat/conversations/group/initialize", [
    "dm.write",
  ]),
  write("initializeChatConversationKeys", "Initialize X chat conversation keys.", "/2/chat/conversations/{id}/keys", [
    "dm.write",
    "tweet.read",
    "users.read",
  ], {
    body: omitBody("id"),
    inputSchema: schema({ id: { type: "string" } }, ["id"]),
  }),
  write("addChatGroupMembers", "Add members to an X chat group.", "/2/chat/conversations/{id}/members", [
    "dm.write",
    "tweet.read",
    "users.read",
  ], {
    body: omitBody("id"),
    inputSchema: schema({ id: { type: "string" } }, ["id"]),
  }),
  write("sendChatMessage", "Send an X chat message.", "/2/chat/conversations/{id}/messages", [
    "dm.write",
    "tweet.read",
    "users.read",
  ], {
    body: omitBody("id"),
    inputSchema: schema({ id: { type: "string" } }, ["id"]),
  }),
  write("markChatConversationRead", "Mark an X chat conversation read.", "/2/chat/conversations/{id}/read", [
    "dm.write",
    "tweet.read",
    "users.read",
  ], {
    body: omitBody("id"),
    inputSchema: schema({ id: { type: "string" } }, ["id"]),
  }),
  write("sendChatTypingIndicator", "Send an X chat typing indicator.", "/2/chat/conversations/{id}/typing", [
    "dm.write",
    "tweet.read",
    "users.read",
  ], {
    body: omitBody("id"),
    inputSchema: schema({ id: { type: "string" } }, ["id"]),
  }),
  sourceWrite("addUserPublicKey", "Add the connected user's X chat public key.", "/2/users/{source_user_id}/public_keys", [
    "dm.write",
    "tweet.read",
    "users.read",
  ]),
  write("createMediaMetadata", "Create X media metadata.", "/2/media/metadata", [
    "media.write",
  ]),
  write("createMediaSubtitles", "Create X media subtitles.", "/2/media/subtitles", [
    "media.write",
  ]),
  write("deleteMediaSubtitles", "Delete X media subtitles.", "/2/media/subtitles", [
    "media.write",
  ], {
    method: "DELETE",
  }),
  write("createCommunityNote", "Create an X Community Note.", "/2/notes", [
    "tweet.write",
  ]),
  write("deleteCommunityNote", "Delete an X Community Note.", "/2/notes/{id}", [
    "tweet.write",
  ], {
    body: undefined,
    inputSchema: schema({ id: { type: "string" } }, ["id"]),
    method: "DELETE",
  }),
  write("evaluateCommunityNote", "Evaluate an X Community Note.", "/2/evaluate_note", [
    "tweet.write",
  ]),
];

export const X_OPERATION_DEFINITIONS = [
  ...readOperations,
  ...writeOperations,
] as const satisfies XOperationDefinition[];

export const X_SOCIAL_WRITE_TOOL_NAMES = writeOperations.map(
  (operation) => operation.name
);

export function getXOperationDefinitions(): XOperationDefinition[] {
  return [...X_OPERATION_DEFINITIONS];
}

export function getXOperationDefinition(
  name: string
): XOperationDefinition | undefined {
  return X_OPERATION_DEFINITIONS.find((operation) => operation.name === name);
}

export function getXToolDefinitionsForScopes(
  scopes: readonly string[]
): XToolDefinition[] {
  return X_OPERATION_DEFINITIONS.filter((operation) =>
    hasScopesForXOperation(operation, scopes)
  ).map(operationToolDefinition);
}

export function hasScopesForXOperation(
  operation: XOperationDefinition,
  scopes: readonly string[]
) {
  const scopeSet = new Set(scopes);
  return operation.requiredScopes.every((scope) => scopeSet.has(scope));
}

export function operationToolDefinition(
  operation: XOperationDefinition
): XToolDefinition {
  return {
    description: operation.description,
    inputSchema: operation.inputSchema,
    name: operation.name,
  };
}

export function buildXOperationRequest(input: {
  apiOrigin: string;
  connectedActorId?: string | null;
  operation: XOperationDefinition;
  toolInput: Record<string, unknown>;
}): XOperationRequest {
  if (input.operation.sourceUserId === "connected_actor" && !input.connectedActorId) {
    throw new XAppNodeError(
      "X_TOOL_CALL_FAILED",
      "Connected X actor id is required."
    );
  }

  const apiOrigin = input.apiOrigin.replace(/\/+$/, "");
  const params =
    input.operation.pathParams?.(input.toolInput, input.connectedActorId) ??
    standardPathParams(input.toolInput, input.connectedActorId);
  const path = applyPathParams(input.operation.path, params);
  const url = withQuery(`${apiOrigin}${path}`, input.operation.query?.(input.toolInput));
  const rawBody = input.operation.body?.(input.toolInput);
  const body = rawBody === undefined ? undefined : JSON.stringify(rawBody);

  return {
    body,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    method: input.operation.method,
    url,
  };
}

function write(
  name: string,
  description: string,
  path: string,
  requiredScopes: string[],
  overrides: Partial<XOperationDefinition> = {}
): XOperationDefinition {
  return {
    body: bodyFromInput,
    classification: "write",
    description,
    inputSchema: objectSchema,
    method: "POST",
    name,
    path,
    requiredScopes,
    ...overrides,
  };
}

function sourceWrite(
  name: string,
  description: string,
  path: string,
  requiredScopes: string[],
  overrides: Partial<XOperationDefinition> = {}
): XOperationDefinition {
  return {
    ...write(name, description, path, requiredScopes, overrides),
    sourceUserId: "connected_actor",
  };
}

function applyPathParams(path: string, params: Record<string, string>) {
  return path.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = params[key];
    if (!value) {
      throw new XAppNodeError(
        "X_TOOL_CALL_FAILED",
        `X tool argument ${key} is required.`
      );
    }
    return encodeURIComponent(value);
  });
}

function withQuery(
  baseUrl: string,
  params: Record<string, string | undefined> | undefined
) {
  if (!params) {
    return baseUrl;
  }
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
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
