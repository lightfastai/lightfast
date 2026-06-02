import { resolveAuthContextFromClerk } from "@api/app/auth/identity";
import {
  getWorkspaceAssistantConversationByPublicId,
  setWorkspaceAssistantConversationActiveStream,
} from "@db/app";
import { db } from "@db/app/client";
import { UI_MESSAGE_STREAM_HEADERS } from "@vendor/ai";
import { log } from "@vendor/observability/log/next";
import { getLightfastResumableStreamContext } from "~/app/(chat)/api/chat/resumable-stream";

export const maxDuration = 30;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authContext = await resolveAuthContextFromClerk({
    db,
    headers: _req.headers,
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

  const { id } = await params;
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
    await setWorkspaceAssistantConversationActiveStream(db, {
      clerkOrgId: identity.orgId,
      createdByUserId: identity.userId,
      expectedStreamId: conversation.activeStreamId,
      publicId: conversation.publicId,
      streamId: null,
    });
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
