import {
  getWorkspaceAssistantConversationByPublicId,
  setWorkspaceAssistantConversationActiveStream,
} from "@db/app";
import { db } from "@db/app/client";
import { UI_MESSAGE_STREAM_HEADERS } from "@vendor/ai";
import { isResumableStreamEnabled } from "~/chat/resumable-stream-config";
import { resolveWorkspaceAssistantAuthContext } from "~/server/chat/auth";
import { getLightfastResumableStreamContext } from "~/server/chat/resumable-stream";
import { log } from "~/server/log";

export async function handleWorkspaceAssistantStreamRequest(
  _request: Request,
  id: string
) {
  const authContext = await resolveWorkspaceAssistantAuthContext({
    db,
  });
  const identity = authContext.identity;

  if (identity.type === "unauthenticated") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (identity.type !== "active") {
    return Response.json({ error: "Organization required" }, { status: 403 });
  }
  if (identity.orgGate.bindingStatus !== "bound") {
    return Response.json(
      { error: "Organization setup required" },
      { status: 403 }
    );
  }

  // Local dev does not publish to Redis, so there is nothing to resume.
  if (!isResumableStreamEnabled) {
    return new Response(null, { status: 204 });
  }

  const conversation = await getWorkspaceAssistantConversationByPublicId(db, {
    clerkOrgId: identity.orgId,
    createdByUserId: identity.userId,
    publicId: id,
  });

  if (!conversation) {
    return Response.json(
      { error: "Workspace assistant conversation not found" },
      { status: 404 }
    );
  }
  if (!conversation.activeStreamId) {
    log.info("[workspace-assistant] no active stream to resume", {
      clerkOrgId: identity.orgId,
      conversationId: conversation.publicId,
      userId: identity.userId,
    });
    return new Response(null, { status: 204 });
  }

  const stream =
    await getLightfastResumableStreamContext().resumeExistingStream(
      conversation.activeStreamId
    );

  if (!stream) {
    log.warn("[workspace-assistant] clearing stale active stream", {
      clerkOrgId: identity.orgId,
      streamId: conversation.activeStreamId,
      conversationId: conversation.publicId,
      userId: identity.userId,
    });
    const updatedConversation =
      await setWorkspaceAssistantConversationActiveStream(db, {
        clerkOrgId: identity.orgId,
        createdByUserId: identity.userId,
        expectedStreamId: conversation.activeStreamId,
        publicId: conversation.publicId,
        streamId: null,
      });
    if (!updatedConversation) {
      log.warn("[workspace-assistant] failed to clear stale stream id", {
        clerkOrgId: identity.orgId,
        streamId: conversation.activeStreamId,
        conversationId: conversation.publicId,
        userId: identity.userId,
      });
    }
    return new Response(null, { status: 204 });
  }

  log.info("[workspace-assistant] resumed active stream", {
    clerkOrgId: identity.orgId,
    streamId: conversation.activeStreamId,
    conversationId: conversation.publicId,
    userId: identity.userId,
  });

  return new Response(stream, {
    headers: {
      ...UI_MESSAGE_STREAM_HEADERS,
      "x-lightfast-workspace-assistant-conversation-id": conversation.publicId,
    },
  });
}
