import type {
  Database,
  WorkspaceAssistantConversation,
  WorkspaceAssistantGeneration,
  WorkspaceAssistantMessage,
} from "@db/app";
import { describe, expect, it, vi } from "vitest";

import {
  workspaceAssistantConversations,
  workspaceAssistantGenerations,
  workspaceAssistantMessages,
} from "../schema";
import {
  appendWorkspaceAssistantMessage,
  createWorkspaceAssistantConversation,
  createWorkspaceAssistantGeneration,
  getWorkspaceAssistantConversationByPublicId,
  listWorkspaceAssistantConversations,
  listWorkspaceAssistantMessages,
  markWorkspaceAssistantGenerationCompleted,
  markWorkspaceAssistantMessageCompleted,
} from "../utils/workspace-assistant";

describe("workspace assistant repository", () => {
  it("creates addressable org-scoped conversations and lists non-deleted conversations", async () => {
    const { db, state } = makeChatDb();

    const conversation = await createWorkspaceAssistantConversation(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      title: "  Summarize my active opportunities  ",
    });

    expect(conversation).toMatchObject({
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      status: "active",
      title: "Summarize my active opportunities",
    });
    expect(conversation.publicId).toMatch(/^conv_/);

    state.conversations.push(
      makeConversation({ id: 99, publicId: "conv_deleted", status: "deleted" })
    );

    await expect(
      getWorkspaceAssistantConversationByPublicId(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        publicId: conversation.publicId,
      })
    ).resolves.toEqual(conversation);
    await expect(
      listWorkspaceAssistantConversations(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
      })
    ).resolves.toMatchObject({
      items: [conversation],
      nextCursor: null,
    });
  });

  it("appends messages with stable public ids and conversation-local sequence numbers", async () => {
    const { db, state } = makeChatDb();
    const conversation = await createWorkspaceAssistantConversation(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      title: "Summarize my active opportunities",
    });

    const userMessage = await appendWorkspaceAssistantMessage(db, {
      createdByUserId: "user_test",
      parts: [{ text: "Summarize my active opportunities", type: "text" }],
      publicId: "msg_user_1",
      role: "user",
      status: "completed",
      conversation,
    });
    const assistantMessage = await appendWorkspaceAssistantMessage(db, {
      createdByUserId: "user_test",
      parts: [],
      publicId: "msg_assistant_1",
      role: "assistant",
      status: "streaming",
      conversation,
    });

    expect(userMessage.sequence).toBe(0);
    expect(assistantMessage.sequence).toBe(1);
    expect(state.conversations[0]).toMatchObject({
      lastMessageId: assistantMessage.id,
      title: "Summarize my active opportunities",
    });
    await expect(
      listWorkspaceAssistantMessages(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        conversation,
      })
    ).resolves.toEqual([userMessage, assistantMessage]);
  });

  it("returns the existing message when an idempotent append is retried", async () => {
    const { db, state } = makeChatDb();
    const conversation = await createWorkspaceAssistantConversation(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      title: "Summarize my active opportunities",
    });

    const first = await appendWorkspaceAssistantMessage(db, {
      createdByUserId: "user_test",
      idempotencyKey: "idem_user_1",
      parts: [{ text: "Summarize my active opportunities", type: "text" }],
      publicId: "msg_user_1",
      role: "user",
      status: "completed",
      conversation,
    });
    const retry = await appendWorkspaceAssistantMessage(db, {
      createdByUserId: "user_test",
      idempotencyKey: "idem_user_1",
      parts: [{ text: "Summarize my active opportunities", type: "text" }],
      publicId: "msg_user_retry",
      role: "user",
      status: "completed",
      conversation,
    });

    expect(retry).toEqual(first);
    expect(state.messages).toHaveLength(1);
  });

  it("does not move conversation last-message metadata backwards on stale idempotent retries", async () => {
    const { db, state } = makeChatDb();
    const conversation = await createWorkspaceAssistantConversation(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      title: "Summarize my active opportunities",
    });
    const first = await appendWorkspaceAssistantMessage(db, {
      createdByUserId: "user_test",
      idempotencyKey: "idem_user_1",
      parts: [{ text: "Summarize my active opportunities", type: "text" }],
      publicId: "msg_user_1",
      role: "user",
      status: "completed",
      conversation,
    });
    const newerLastMessageAt = new Date("2026-06-02T00:01:00.000Z");
    state.conversations[0] = {
      ...state.conversations[0]!,
      lastMessageAt: newerLastMessageAt,
      lastMessageId: 99,
    };

    const retry = await appendWorkspaceAssistantMessage(db, {
      createdByUserId: "user_test",
      idempotencyKey: "idem_user_1",
      parts: [{ text: "Summarize my active opportunities", type: "text" }],
      publicId: "msg_user_retry",
      role: "user",
      status: "completed",
      conversation,
    });

    expect(retry).toEqual(first);
    expect(state.conversations[0]).toMatchObject({
      lastMessageAt: newerLastMessageAt,
      lastMessageId: 99,
    });
  });

  it("retries sequence collisions instead of duplicating max plus one", async () => {
    const duplicateSequenceError = Object.assign(
      new Error("Duplicate entry for key"),
      { code: "ER_DUP_ENTRY" }
    );
    const { db, state } = makeChatDb({
      messageInsertErrors: [duplicateSequenceError],
    });
    const conversation = await createWorkspaceAssistantConversation(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      title: "Summarize my active opportunities",
    });
    state.messages.push(
      makeMessage({
        id: 99,
        publicId: "msg_existing",
        sequence: 0,
      })
    );

    const inserted = await appendWorkspaceAssistantMessage(db, {
      createdByUserId: "user_test",
      idempotencyKey: "idem_user_2",
      parts: [{ text: "Try again", type: "text" }],
      publicId: "msg_user_2",
      role: "user",
      status: "completed",
      conversation,
    });

    expect(inserted.sequence).toBe(1);
    expect(state.messages.map((message) => message.publicId)).toEqual([
      "msg_existing",
      "msg_user_2",
    ]);
  });

  it("records a generation lifecycle for the assistant message", async () => {
    const { db, state } = makeChatDb();
    const conversation = await createWorkspaceAssistantConversation(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      title: "Summarize my active opportunities",
    });
    const assistantMessage = await appendWorkspaceAssistantMessage(db, {
      createdByUserId: "user_test",
      parts: [],
      publicId: "msg_assistant_1",
      role: "assistant",
      status: "streaming",
      conversation,
    });

    const generation = await createWorkspaceAssistantGeneration(db, {
      assistantMessage,
      model: "anthropic/claude-sonnet-4.6",
      requestedByUserId: "user_test",
      requestMetadata: { source: "workspace-assistant" },
      status: "streaming",
      conversation,
    });

    expect(generation).toMatchObject({
      assistantMessageId: assistantMessage.id,
      model: "anthropic/claude-sonnet-4.6",
      status: "streaming",
    });

    await markWorkspaceAssistantMessageCompleted(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      parts: [{ text: "You do not have any opportunities yet.", type: "text" }],
      publicId: assistantMessage.publicId,
    });
    await markWorkspaceAssistantGenerationCompleted(db, {
      clerkOrgId: "org_test",
      finishReason: "stop",
      providerMetadata: { gateway: { routed: true } },
      publicId: generation.publicId,
      requestedByUserId: "user_test",
      usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
    });

    expect(state.messages[0]).toMatchObject({
      parts: [{ text: "You do not have any opportunities yet.", type: "text" }],
      status: "completed",
    });
    expect(state.generations[0]).toMatchObject({
      finishReason: "stop",
      status: "completed",
      usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
    });
  });

  it("only reads and updates rows matching mocked where conditions", async () => {
    const { db, state } = makeChatDb();
    const conversation = await createWorkspaceAssistantConversation(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      title: "Scope test",
    });
    const otherConversation = await createWorkspaceAssistantConversation(db, {
      clerkOrgId: "org_other",
      createdByUserId: "user_other",
      title: "Other org chat",
    });

    await appendWorkspaceAssistantMessage(db, {
      createdByUserId: "user_test",
      parts: [{ text: "Test message", type: "text" }],
      publicId: "msg_user_test",
      role: "user",
      status: "streaming",
      conversation,
    });
    await appendWorkspaceAssistantMessage(db, {
      createdByUserId: "user_other",
      parts: [{ text: "Wrong org message", type: "text" }],
      publicId: "msg_user_other_org",
      role: "user",
      status: "streaming",
      conversation: otherConversation,
    });

    const crossOrgMessages = await listWorkspaceAssistantMessages(db, {
      clerkOrgId: "org_other",
      createdByUserId: "user_other",
      conversation,
    });
    expect(crossOrgMessages).toEqual([]);

    const messageToMark = state.messages.find(
      (message) => message.publicId === "msg_user_test"
    );
    expect(messageToMark).toBeDefined();
    expect(messageToMark?.status).toBe("streaming");
    await markWorkspaceAssistantMessageCompleted(db, {
      clerkOrgId: "org_other",
      createdByUserId: "user_other",
      parts: [{ text: "updated from wrong org", type: "text" }],
      publicId: "msg_user_test",
    });
    const unchangedMessage = state.messages.find(
      (message) => message.publicId === "msg_user_test"
    );
    expect(unchangedMessage?.status).toBe("streaming");

    await markWorkspaceAssistantMessageCompleted(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      parts: [{ text: "updated from owner org", type: "text" }],
      publicId: "msg_user_test",
    });
    const changedMessage = state.messages.find(
      (message) => message.publicId === "msg_user_test"
    );
    expect(changedMessage?.status).toBe("completed");
    expect(changedMessage?.parts).toEqual([
      { text: "updated from owner org", type: "text" },
    ]);
  });

  it("rejects generations for non-assistant messages", async () => {
    const { db } = makeChatDb();
    const conversation = await createWorkspaceAssistantConversation(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      title: "Summarize my active opportunities",
    });
    const userMessage = await appendWorkspaceAssistantMessage(db, {
      createdByUserId: "user_test",
      parts: [{ text: "Summarize my active opportunities", type: "text" }],
      publicId: "msg_user_1",
      role: "user",
      status: "completed",
      conversation,
    });

    await expect(
      createWorkspaceAssistantGeneration(db, {
        assistantMessage: userMessage,
        model: "anthropic/claude-sonnet-4.6",
        requestedByUserId: "user_test",
        status: "streaming",
        conversation,
      })
    ).rejects.toThrow("assistant message");
  });

  it("rejects generations for assistant messages from another conversation", async () => {
    const { db } = makeChatDb();
    const conversation = await createWorkspaceAssistantConversation(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      title: "Summarize my active opportunities",
    });
    const assistantMessage = await appendWorkspaceAssistantMessage(db, {
      createdByUserId: "user_test",
      parts: [],
      publicId: "msg_assistant_1",
      role: "assistant",
      status: "streaming",
      conversation,
    });

    await expect(
      createWorkspaceAssistantGeneration(db, {
        assistantMessage: {
          ...assistantMessage,
          conversationId: 99,
          conversationPublicId: "conv_other",
        },
        model: "anthropic/claude-sonnet-4.6",
        requestedByUserId: "user_test",
        status: "streaming",
        conversation,
      })
    ).rejects.toThrow("another workspace assistant conversation");
  });
});

function makeChatDb(options: { messageInsertErrors?: unknown[] } = {}) {
  const state = {
    generations: [] as WorkspaceAssistantGeneration[],
    messages: [] as WorkspaceAssistantMessage[],
    conversations: [] as WorkspaceAssistantConversation[],
  };
  let nextGenerationId = 1;
  let nextMessageId = 1;
  let nextConversationId = 1;

  const db = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (value: Record<string, unknown>) => {
        if (table === workspaceAssistantConversations) {
          state.conversations.push(
            makeConversation({
              ...value,
              id: nextConversationId++,
            })
          );
        }
        if (table === workspaceAssistantMessages) {
          const duplicateMessage = state.messages.find(
            (message) =>
              message.conversationId === value.conversationId &&
              value.idempotencyKey &&
              message.idempotencyKey === value.idempotencyKey
          );
          if (duplicateMessage) {
            throw Object.assign(new Error("Duplicate entry for key"), {
              code: "ER_DUP_ENTRY",
            });
          }
          const nextError = options.messageInsertErrors?.shift();
          if (nextError) {
            throw nextError;
          }
          state.messages.push(
            makeMessage({
              ...value,
              id: nextMessageId++,
            })
          );
        }
        if (table === workspaceAssistantGenerations) {
          state.generations.push(
            makeGeneration({
              ...value,
              id: nextGenerationId++,
            })
          );
        }
      }),
    })),
    select: vi.fn((projection?: Record<string, unknown>) => ({
      from: (table: unknown) => ({
        where: (condition?: unknown) => ({
          limit: (limit: number) =>
            Promise.resolve(
              selectPointRows(state, table, condition, projection).slice(
                0,
                limit
              )
            ),
          orderBy: () =>
            orderedRows(selectRows(state, table, condition, projection)),
        }),
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: (value: Record<string, unknown>) => ({
        where: vi.fn(async (condition?: unknown) => {
          updateRows(state, table, value, condition);
        }),
      }),
    })),
  };

  return { db: db as unknown as Database, state };
}

type WorkspaceAssistantMockRow =
  | WorkspaceAssistantConversation
  | WorkspaceAssistantMessage
  | WorkspaceAssistantGeneration;

function getTableRows(
  state: {
    generations: WorkspaceAssistantGeneration[];
    messages: WorkspaceAssistantMessage[];
    conversations: WorkspaceAssistantConversation[];
  },
  table: unknown
) {
  if (table === workspaceAssistantConversations) {
    return state.conversations;
  }
  if (table === workspaceAssistantMessages) {
    return state.messages;
  }
  if (table === workspaceAssistantGenerations) {
    return state.generations;
  }
  return [];
}

function orderedRows(rows: unknown[]) {
  return Object.assign(Promise.resolve(rows), {
    limit: (limit: number) => Promise.resolve(rows.slice(0, limit)),
  });
}

function selectPointRows(
  state: {
    generations: WorkspaceAssistantGeneration[];
    messages: WorkspaceAssistantMessage[];
    conversations: WorkspaceAssistantConversation[];
  },
  table: unknown,
  condition: unknown,
  projection?: Record<string, unknown>
) {
  const rows = selectRows(state, table, condition, projection);
  if (projection) {
    return rows;
  }
  return rows.slice(-1);
}

function selectRows(
  state: {
    generations: WorkspaceAssistantGeneration[];
    messages: WorkspaceAssistantMessage[];
    conversations: WorkspaceAssistantConversation[];
  },
  table: unknown,
  condition: unknown,
  projection?: Record<string, unknown>
) {
  const whereCondition = (row: WorkspaceAssistantMockRow) =>
    evaluateWorkspaceAssistantWhereCondition(table, row, condition);

  if (projection && "sequence" in projection) {
    const rows = state.messages.filter((message) => whereCondition(message));
    const maxSequence = rows.reduce(
      (max, message) => Math.max(max, message.sequence),
      -1
    );
    return [{ sequence: maxSequence }];
  }

  if (table === workspaceAssistantConversations) {
    return state.conversations.filter(
      (conversation) =>
        conversation.status !== "deleted" && whereCondition(conversation)
    );
  }
  if (table === workspaceAssistantMessages) {
    return state.messages.filter(whereCondition);
  }
  if (table === workspaceAssistantGenerations) {
    return state.generations.filter(whereCondition);
  }
  return [];
}

function updateRows(
  state: {
    generations: WorkspaceAssistantGeneration[];
    messages: WorkspaceAssistantMessage[];
    conversations: WorkspaceAssistantConversation[];
  },
  table: unknown,
  value: Record<string, unknown>,
  condition: unknown
) {
  const rows = getTableRows(state, table);
  for (const row of rows.filter((candidate) =>
    evaluateWorkspaceAssistantWhereCondition(table, candidate, condition)
  )) {
    Object.assign(row, value);
  }
}

interface ColumnReferenceChunk {
  columnType?: string;
  name: string;
}

interface SQLConditionChunk {
  queryChunks: unknown[];
}

interface ValueChunk {
  value?: unknown;
}

function isColumnChunk(value: unknown): value is ColumnReferenceChunk {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { columnType?: unknown }).columnType === "string" &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

function isSQLChunk(value: unknown): value is SQLConditionChunk {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as { queryChunks?: unknown[] }).queryChunks)
  );
}

function isParamChunk(value: unknown): value is ValueChunk {
  return (
    !!value &&
    typeof value === "object" &&
    "value" in value &&
    !Array.isArray((value as { value?: unknown }).value)
  );
}

function getChunkText(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }
  const chunk = value as { value?: unknown };
  if (Array.isArray(chunk.value)) {
    return chunk.value.join("");
  }
  if (typeof chunk.value === "string") {
    return chunk.value;
  }
  return "";
}

const workspaceAssistantConversationColumnToProperty = {
  clerk_org_id: "clerkOrgId",
  created_by_user_id: "createdByUserId",
  public_id: "publicId",
  status: "status",
  id: "id",
  updated_at: "updatedAt",
  active_stream_id: "activeStreamId",
} as const satisfies Record<string, keyof WorkspaceAssistantConversation>;

const workspaceAssistantMessageColumnToProperty = {
  clerk_org_id: "clerkOrgId",
  created_by_user_id: "createdByUserId",
  conversation_id: "conversationId",
  public_id: "publicId",
  conversation_public_id: "conversationPublicId",
  idempotency_key: "idempotencyKey",
} as const satisfies Record<string, keyof WorkspaceAssistantMessage>;

const workspaceAssistantGenerationColumnToProperty = {
  assistant_message_id: "assistantMessageId",
  clerk_org_id: "clerkOrgId",
  requested_by_user_id: "requestedByUserId",
  public_id: "publicId",
} as const satisfies Record<string, keyof WorkspaceAssistantGeneration>;

function getRowValue(
  table: unknown,
  column: string,
  row:
    | WorkspaceAssistantConversation
    | WorkspaceAssistantMessage
    | WorkspaceAssistantGeneration
) {
  const conversationProperty =
    workspaceAssistantConversationColumnToProperty[
      column as keyof typeof workspaceAssistantConversationColumnToProperty
    ];
  if (conversationProperty && table === workspaceAssistantConversations) {
    return (row as Record<string, unknown>)[conversationProperty];
  }

  const messageProperty =
    workspaceAssistantMessageColumnToProperty[
      column as keyof typeof workspaceAssistantMessageColumnToProperty
    ];
  if (messageProperty && table === workspaceAssistantMessages) {
    return (row as Record<string, unknown>)[messageProperty];
  }

  const generationProperty =
    workspaceAssistantGenerationColumnToProperty[
      column as keyof typeof workspaceAssistantGenerationColumnToProperty
    ];
  if (generationProperty && table === workspaceAssistantGenerations) {
    return (row as Record<string, unknown>)[generationProperty];
  }

  return;
}

function compareWithOperator({
  actual,
  operator,
  expected,
}: {
  actual: unknown;
  operator: string;
  expected: unknown;
}): boolean {
  if (
    actual === null ||
    actual === undefined ||
    expected === null ||
    expected === undefined
  ) {
    return false;
  }

  let left: string | number | boolean;
  let right: string | number | boolean;

  if (
    typeof actual === "boolean" ||
    typeof actual === "number" ||
    typeof actual === "string"
  ) {
    if (
      typeof expected !== "boolean" &&
      typeof expected !== "number" &&
      typeof expected !== "string"
    ) {
      return false;
    }
    left = actual;
    right = expected;
  } else if (actual instanceof Date) {
    if (!(expected instanceof Date) && typeof expected !== "number") {
      return false;
    }
    left = actual.getTime();
    right = expected instanceof Date ? expected.getTime() : expected;
  } else {
    return false;
  }

  switch (operator) {
    case "!=":
    case "<>":
      return left !== right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    default:
      return left === right;
  }
}

function evaluateWorkspaceAssistantWhereCondition(
  table: unknown,
  row: WorkspaceAssistantMockRow,
  condition: unknown
): boolean {
  if (!condition || typeof condition !== "object") {
    return true;
  }

  if (!isSQLChunk(condition)) {
    return true;
  }

  return evaluateWorkspaceAssistantWhereChunks(
    table,
    row,
    condition.queryChunks
  );
}

function evaluateWorkspaceAssistantWhereChunks(
  table: unknown,
  row: WorkspaceAssistantMockRow,
  chunks: unknown[]
): boolean {
  if (!chunks.length) {
    return true;
  }

  const values: boolean[] = [];
  const operators: Array<"and" | "or"> = [];
  const groupedChunks: unknown[][] = [[]];

  for (const chunk of chunks) {
    const text = getChunkText(chunk).toLowerCase();
    if (/^\s*and\s*$/i.test(text)) {
      operators.push("and");
      groupedChunks.push([]);
      continue;
    }
    if (/^\s*or\s*$/i.test(text)) {
      operators.push("or");
      groupedChunks.push([]);
      continue;
    }

    const lastGroup = groupedChunks.at(-1);
    if (!lastGroup) {
      return true;
    }
    lastGroup.push(chunk);
  }

  for (const group of groupedChunks) {
    const candidateChunks = group.filter(
      (value) => value !== "(" && value !== ")"
    );

    if (candidateChunks.length === 0) {
      values.push(true);
      continue;
    }
    const nestedChunks = candidateChunks.filter(isSQLChunk);
    if (nestedChunks.length > 0) {
      values.push(
        nestedChunks.every((chunk) =>
          evaluateWorkspaceAssistantWhereCondition(table, row, chunk)
        )
      );
      continue;
    }

    values.push(
      evaluateWorkspaceAssistantWherePredicate(table, row, candidateChunks)
    );
  }

  if (values.length === 0) {
    return true;
  }

  let result = values[0]!;
  for (
    let index = 0;
    index < operators.length && index < values.length - 1;
    index++
  ) {
    const next = values[index + 1];
    if (next === undefined) {
      continue;
    }
    if (operators[index] === "or") {
      result = result || next;
    } else {
      result = result && next;
    }
  }

  return result;
}

function evaluateWorkspaceAssistantWherePredicate(
  table: unknown,
  row: WorkspaceAssistantMockRow,
  chunks: unknown[]
): boolean {
  const text = chunks.map(getChunkText).join("").toLowerCase();
  const column = chunks.find(isColumnChunk)?.name;
  if (!column) {
    return true;
  }

  const expected = chunks.find(isParamChunk)?.value;
  const actual = getRowValue(table, column, row);
  if (text.includes(" is not null")) {
    return actual !== null;
  }
  if (text.includes(" is null")) {
    return actual === null;
  }
  if (text.includes("!=") || text.includes("<>")) {
    return actual !== expected;
  }
  if (text.includes("<=")) {
    return compareWithOperator({ actual, operator: "<=", expected });
  }
  if (text.includes(">=")) {
    return compareWithOperator({ actual, operator: ">=", expected });
  }
  if (text.includes("<")) {
    return compareWithOperator({ actual, operator: "<", expected });
  }
  if (text.includes(">")) {
    return compareWithOperator({ actual, operator: ">", expected });
  }
  return actual === expected;
}

function makeConversation(
  overrides: Partial<WorkspaceAssistantConversation> = {}
): WorkspaceAssistantConversation {
  const now = new Date("2026-06-02T00:00:00.000Z");
  return {
    clerkOrgId: "org_test",
    createdAt: now,
    createdByUserId: "user_test",
    id: 1,
    lastMessageAt: null,
    lastMessageId: null,
    metadata: {},
    publicId: "conv_123e4567-e89b-12d3-a456-426614174000",
    activeStreamId: null,
    status: "active",
    title: null,
    updatedAt: now,
    ...overrides,
  };
}

function makeMessage(
  overrides: Partial<WorkspaceAssistantMessage> = {}
): WorkspaceAssistantMessage {
  const now = new Date("2026-06-02T00:00:00.000Z");
  return {
    conversationId: 1,
    conversationPublicId: "conv_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    createdAt: now,
    createdByUserId: "user_test",
    errorCode: null,
    errorMessage: null,
    id: 1,
    metadata: {},
    parts: [],
    publicId: "msg_123e4567-e89b-12d3-a456-426614174000",
    role: "user",
    sequence: 0,
    idempotencyKey: null,
    status: "completed",
    updatedAt: now,
    ...overrides,
  };
}

function makeGeneration(
  overrides: Partial<WorkspaceAssistantGeneration> = {}
): WorkspaceAssistantGeneration {
  const now = new Date("2026-06-02T00:00:00.000Z");
  return {
    assistantMessageId: 1,
    assistantMessagePublicId: "msg_123e4567-e89b-12d3-a456-426614174000",
    conversationId: 1,
    clerkOrgId: "org_test",
    createdAt: now,
    errorCode: null,
    errorMessage: null,
    finishedAt: null,
    finishReason: null,
    id: 1,
    model: "anthropic/claude-sonnet-4.6",
    providerMetadata: {},
    publicId: "gen_123e4567-e89b-12d3-a456-426614174000",
    requestedByUserId: "user_test",
    requestMetadata: {},
    startedAt: null,
    status: "pending",
    updatedAt: now,
    usage: null,
    ...overrides,
  };
}
