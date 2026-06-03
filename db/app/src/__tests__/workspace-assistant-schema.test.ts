import { getTableConfig } from "drizzle-orm/mysql-core";
import { describe, expect, it } from "vitest";

import {
  orgWorkspaceAssistantContextItems as workspaceAssistantContextItems,
  orgWorkspaceAssistantConversations as workspaceAssistantConversations,
  orgWorkspaceAssistantGenerations as workspaceAssistantGenerations,
  orgWorkspaceAssistantMessages as workspaceAssistantMessages,
  orgWorkspaceAssistantToolCalls as workspaceAssistantToolCalls,
} from "../schema";

function indexColumnNames(index: { config: { columns: unknown[] } }) {
  return index.config.columns.map((column) => {
    expect(column && typeof column === "object" && "name" in column).toBe(true);
    return column && typeof column === "object" && "name" in column
      ? (column.name as string)
      : undefined;
  });
}

describe("workspace assistant schema", () => {
  it("defines addressable org-scoped workspace assistant conversations without attachments", () => {
    const config = getTableConfig(workspaceAssistantConversations);
    const indexes = new Map(
      config.indexes.map((index) => [index.config.name, index])
    );

    expect(config.name).toBe("lightfast_org_workspace_assistant_conversations");
    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "public_id",
        "clerk_org_id",
        "created_by_user_id",
        "title",
        "status",
        "active_stream_id",
        "last_message_id",
        "last_message_at",
        "metadata",
        "created_at",
        "updated_at",
      ])
    );
    expect(
      indexes.get("org_workspace_assistant_conversations_public_id_uq")?.config
    ).toMatchObject({
      unique: true,
    });
    expect(
      indexColumnNames(
        indexes.get("org_workspace_assistant_conversations_public_id_uq")!
      )
    ).toEqual(["public_id"]);
    expect(
      indexColumnNames(
        indexes.get(
          "org_workspace_assistant_conversations_user_status_updated_idx"
        )!
      )
    ).toEqual([
      "clerk_org_id",
      "created_by_user_id",
      "status",
      "updated_at",
      "id",
    ]);
  });

  it("defines durable AI SDK message rows with cursor indexes", () => {
    const config = getTableConfig(workspaceAssistantMessages);
    const indexes = new Map(
      config.indexes.map((index) => [index.config.name, index])
    );

    expect(config.name).toBe("lightfast_org_workspace_assistant_messages");
    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "public_id",
        "conversation_id",
        "conversation_public_id",
        "clerk_org_id",
        "created_by_user_id",
        "role",
        "status",
        "sequence",
        "idempotency_key",
        "parts",
        "metadata",
        "error_code",
        "error_message",
        "created_at",
        "updated_at",
      ])
    );
    expect(
      indexes.get("org_workspace_assistant_messages_public_id_uq")?.config
    ).toMatchObject({
      unique: true,
    });
    expect(
      indexes.get("org_workspace_assistant_messages_conversation_sequence_uq")
        ?.config
    ).toMatchObject({ unique: true });
    expect(
      indexColumnNames(
        indexes.get("org_workspace_assistant_messages_conversation_sequence_uq")!
      )
    ).toEqual(["conversation_id", "sequence"]);
    expect(
      indexes.get(
        "org_workspace_assistant_messages_conversation_idempotency_key_uq"
      )?.config
    ).toMatchObject({ unique: true });
    expect(
      indexColumnNames(
        indexes.get(
          "org_workspace_assistant_messages_conversation_idempotency_key_uq"
        )!
      )
    ).toEqual(["conversation_id", "idempotency_key"]);
    expect(
      indexColumnNames(
        indexes.get("org_workspace_assistant_messages_conversation_created_idx")!
      )
    ).toEqual(["conversation_id", "created_at", "id"]);
    expect(
      indexColumnNames(
        indexes.get(
          "org_workspace_assistant_messages_user_conversation_sequence_idx"
        )!
      )
    ).toEqual([
      "clerk_org_id",
      "created_by_user_id",
      "conversation_id",
      "sequence",
      "id",
    ]);
  });

  it("defines generation and tool-call audit tables", () => {
    const generationConfig = getTableConfig(workspaceAssistantGenerations);
    const toolCallConfig = getTableConfig(workspaceAssistantToolCalls);
    const generationIndexes = new Map(
      generationConfig.indexes.map((index) => [index.config.name, index])
    );
    const toolCallIndexes = new Map(
      toolCallConfig.indexes.map((index) => [index.config.name, index])
    );

    expect(generationConfig.name).toBe(
      "lightfast_org_workspace_assistant_generations"
    );
    expect(generationConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "public_id",
        "conversation_id",
        "assistant_message_id",
        "assistant_message_public_id",
        "clerk_org_id",
        "requested_by_user_id",
        "model",
        "status",
        "finish_reason",
        "usage",
        "provider_metadata",
        "request_metadata",
        "error_code",
        "error_message",
        "started_at",
        "finished_at",
        "created_at",
        "updated_at",
      ])
    );
    expect(
      generationIndexes.get(
        "org_workspace_assistant_generations_assistant_message_uq"
      )?.config
    ).toMatchObject({ unique: true });
    expect(
      indexColumnNames(
        generationIndexes.get(
          "org_workspace_assistant_generations_assistant_message_uq"
        )!
      )
    ).toEqual(["assistant_message_id"]);
    expect(
      indexColumnNames(
        generationIndexes.get("org_workspace_assistant_generations_org_status_idx")!
      )
    ).toEqual(["clerk_org_id", "status", "created_at", "id"]);
    expect(
      indexColumnNames(
        generationIndexes.get(
          "org_workspace_assistant_generations_org_user_status_idx"
        )!
      )
    ).toEqual([
      "clerk_org_id",
      "requested_by_user_id",
      "status",
      "created_at",
      "id",
    ]);

    expect(toolCallConfig.name).toBe(
      "lightfast_org_workspace_assistant_tool_calls"
    );
    expect(toolCallConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "public_id",
        "generation_id",
        "generation_public_id",
        "message_id",
        "clerk_org_id",
        "tool_call_id",
        "tool_name",
        "status",
        "input",
        "output",
        "error_code",
        "error_message",
        "started_at",
        "finished_at",
        "created_at",
        "updated_at",
      ])
    );
    expect(
      toolCallIndexes.get(
        "org_workspace_assistant_tool_calls_generation_tool_call_uq"
      )?.config
    ).toMatchObject({ unique: true });
    expect(
      indexColumnNames(
        toolCallIndexes.get(
          "org_workspace_assistant_tool_calls_generation_tool_call_uq"
        )!
      )
    ).toEqual(["generation_id", "tool_call_id"]);
  });

  it("defines context snapshots for skill and workspace data used by a turn", () => {
    const config = getTableConfig(workspaceAssistantContextItems);
    const indexes = new Map(
      config.indexes.map((index) => [index.config.name, index])
    );

    expect(config.name).toBe("lightfast_org_workspace_assistant_context_items");
    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "public_id",
        "conversation_id",
        "message_id",
        "clerk_org_id",
        "kind",
        "source_public_id",
        "source_slug",
        "title",
        "snapshot",
        "metadata",
        "created_at",
      ])
    );
    expect(
      indexColumnNames(
        indexes.get("org_workspace_assistant_context_items_conversation_kind_idx")!
      )
    ).toEqual(["conversation_id", "kind", "id"]);
    expect(
      indexColumnNames(
        indexes.get("org_workspace_assistant_context_items_message_kind_idx")!
      )
    ).toEqual(["message_id", "kind", "id"]);
  });
});
