import { SIGNAL_ID_PREFIX } from "@repo/api-contract";
import { describe, expect, it } from "vitest";

import {
  AUTOMATION_ID_PREFIX,
  AUTOMATION_RUN_ID_PREFIX,
  createAutomationId,
  createAutomationRunId,
} from "../schema/tables/automations";
import { createPersonId, PERSON_ID_PREFIX } from "../schema/tables/people";
import {
  createProviderRoutineCallId,
  PROVIDER_ROUTINE_CALL_ID_PREFIX,
} from "../schema/tables/provider-routine-calls";
import { createSignalId } from "../schema/tables/signals";
import {
  createWorkspaceAssistantContextItemId,
  createWorkspaceAssistantConversationId,
  createWorkspaceAssistantGenerationId,
  createWorkspaceAssistantMessageId,
  createWorkspaceAssistantToolCallId,
  WORKSPACE_ASSISTANT_CONTEXT_ITEM_ID_PREFIX,
  WORKSPACE_ASSISTANT_CONVERSATION_ID_PREFIX,
  WORKSPACE_ASSISTANT_GENERATION_ID_PREFIX,
  WORKSPACE_ASSISTANT_MESSAGE_ID_PREFIX,
  WORKSPACE_ASSISTANT_TOOL_CALL_ID_PREFIX,
} from "../schema/tables/workspace-assistant";

const PUBLIC_ID_COLUMN_LENGTH = 80;

describe("public id generators", () => {
  it("creates long-prefixed public ids that fit current varchar columns", () => {
    const automationId = createAutomationId();
    const automationRunId = createAutomationRunId();
    const providerRoutineCallId = createProviderRoutineCallId();
    const workspaceAssistantContextItemId =
      createWorkspaceAssistantContextItemId();
    const workspaceAssistantGenerationId =
      createWorkspaceAssistantGenerationId();
    const workspaceAssistantMessageId = createWorkspaceAssistantMessageId();
    const conversationId = createWorkspaceAssistantConversationId();
    const workspaceAssistantToolCallId = createWorkspaceAssistantToolCallId();
    const signalId = createSignalId();
    const personId = createPersonId();

    expect(automationId.startsWith(AUTOMATION_ID_PREFIX)).toBe(true);
    expect(automationRunId.startsWith(AUTOMATION_RUN_ID_PREFIX)).toBe(true);
    expect(providerRoutineCallId.startsWith(PROVIDER_ROUTINE_CALL_ID_PREFIX)).toBe(
      true
    );
    expect(
      workspaceAssistantContextItemId.startsWith(
        WORKSPACE_ASSISTANT_CONTEXT_ITEM_ID_PREFIX
      )
    ).toBe(true);
    expect(
      workspaceAssistantGenerationId.startsWith(
        WORKSPACE_ASSISTANT_GENERATION_ID_PREFIX
      )
    ).toBe(true);
    expect(
      workspaceAssistantMessageId.startsWith(
        WORKSPACE_ASSISTANT_MESSAGE_ID_PREFIX
      )
    ).toBe(true);
    expect(
      conversationId.startsWith(WORKSPACE_ASSISTANT_CONVERSATION_ID_PREFIX)
    ).toBe(true);
    expect(
      workspaceAssistantToolCallId.startsWith(
        WORKSPACE_ASSISTANT_TOOL_CALL_ID_PREFIX
      )
    ).toBe(true);
    expect(signalId.startsWith(SIGNAL_ID_PREFIX)).toBe(true);
    expect(personId.startsWith(PERSON_ID_PREFIX)).toBe(true);
    expect(automationId).toMatch(
      /^automation_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(automationRunId).toMatch(
      /^automation_run_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(providerRoutineCallId).toMatch(
      /^provider_routine_call_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(workspaceAssistantContextItemId).toMatch(
      /^ctx_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(workspaceAssistantGenerationId).toMatch(
      /^gen_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(workspaceAssistantMessageId).toMatch(
      /^msg_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(conversationId).toMatch(
      /^conv_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(workspaceAssistantToolCallId).toMatch(
      /^tool_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(signalId).toMatch(
      /^signal_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(personId).toMatch(
      /^person_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(automationId.length).toBeLessThanOrEqual(PUBLIC_ID_COLUMN_LENGTH);
    expect(automationRunId.length).toBeLessThanOrEqual(PUBLIC_ID_COLUMN_LENGTH);
    expect(providerRoutineCallId.length).toBeLessThanOrEqual(
      PUBLIC_ID_COLUMN_LENGTH
    );
    expect(workspaceAssistantContextItemId.length).toBeLessThanOrEqual(
      PUBLIC_ID_COLUMN_LENGTH
    );
    expect(workspaceAssistantGenerationId.length).toBeLessThanOrEqual(
      PUBLIC_ID_COLUMN_LENGTH
    );
    expect(workspaceAssistantMessageId.length).toBeLessThanOrEqual(
      PUBLIC_ID_COLUMN_LENGTH
    );
    expect(conversationId.length).toBeLessThanOrEqual(PUBLIC_ID_COLUMN_LENGTH);
    expect(workspaceAssistantToolCallId.length).toBeLessThanOrEqual(
      PUBLIC_ID_COLUMN_LENGTH
    );
    expect(signalId.length).toBeLessThanOrEqual(PUBLIC_ID_COLUMN_LENGTH);
    expect(personId.length).toBeLessThanOrEqual(PUBLIC_ID_COLUMN_LENGTH);
  });
});
