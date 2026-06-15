import { getVisibleSignalByPublicId } from "@db/app";
import { db } from "@db/app/client";
import { getMcpSignalCommandInput, getSignalOutput } from "@repo/api-contract";
import { createFileRoute } from "@tanstack/react-router";
import { jsonError, verifyMcpServiceRequest } from "~/server/mcp-service-auth";

export const Route = createFileRoute("/api/internal/mcp/signals/get")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await verifyMcpServiceRequest(request);
        if (authError) {
          return authError;
        }

        const body = await request.json().catch(() => undefined);
        const parsed = getMcpSignalCommandInput.safeParse(body);
        if (!parsed.success) {
          return jsonError(
            "invalid_request",
            "MCP signal get request is invalid.",
            400
          );
        }

        try {
          const { assertHostedMcpOrgAccess } = await import(
            "@api/app/mcp-oauth/resource-access"
          );
          await assertHostedMcpOrgAccess(db, {
            orgId: parsed.data.actor.orgId,
            userId: parsed.data.actor.userId,
          });
          const signal = await getVisibleSignalByPublicId(db, {
            publicId: parsed.data.id,
            clerkOrgId: parsed.data.actor.orgId,
            createdByUserId: parsed.data.actor.userId,
          });

          if (!signal) {
            return jsonError("not_found", "Signal not found.", 404);
          }

          const output = getSignalOutput.parse({
            id: signal.publicId,
            input: signal.input,
            status: signal.status,
            classification: signal.classification,
            visibilityScope: signal.visibilityScope,
            createdAt: signal.createdAt.toISOString(),
            updatedAt: signal.updatedAt.toISOString(),
          });
          return Response.json(output, { status: 200 });
        } catch (error) {
          if (
            error &&
            typeof error === "object" &&
            "status" in error &&
            (error as { status: unknown }).status === 403
          ) {
            return jsonError(
              "org_access_denied",
              error instanceof Error
                ? error.message
                : "MCP organization access denied.",
              403
            );
          }
          return jsonError("internal_error", "Failed to get signal.", 500);
        }
      },
    },
  },
});
