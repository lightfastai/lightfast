import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { put } from "@vendor/storage";
import { env } from "@vendor/storage/env";

import { getModelConfig } from "~/ai/providers";
import type { ModelId } from "~/ai/providers";
import { getUserPlan } from "../../../[...v]/_lib/user-utils";
import { ClerkPlanKey, BILLING_LIMITS } from "~/lib/billing/types";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_COUNT,
  PDF_MIME_TYPE,
} from "~/lib/attachments/constants";
import {
  inferAttachmentKind,
  ensureAttachmentAllowed,
  sanitizeAttachmentFilename,
  type AttachmentKind,
} from "~/lib/attachments/utils";

const SUPPORTED_AGENT_ID = "c010";

type AttachmentMetadata = {
  id?: string;
  mediaType?: string | null;
  filename?: string | null;
  size?: number | null;
};

type UploadResult = {
  id: string;
  url: string;
  storagePath: string;
  size: number;
  contentType: string;
  filename?: string;
  metadata?: Record<string, unknown> | null;
};

function buildErrorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

async function ensurePlanAllowsAttachments(plan: ClerkPlanKey) {
  const limits = BILLING_LIMITS[plan];
  if (!limits.hasWebSearch) {
    throw new Response(
      JSON.stringify({ error: "Attachments require web search access." }),
      { status: 403 },
    );
  }
}

function validateAttachmentLimits(files: File[]) {
  if (files.length === 0) {
    throw new Response(JSON.stringify({ error: "No files provided." }), {
      status: 400,
    });
  }

  if (files.length > MAX_ATTACHMENT_COUNT) {
    throw new Response(
      JSON.stringify({
        error: `You can attach up to ${MAX_ATTACHMENT_COUNT} files per message.`,
      }),
      { status: 400 },
    );
  }
}

function validateAttachmentKind(
  kind: AttachmentKind,
  allowImages: boolean,
  allowPdf: boolean,
) {
  if (ensureAttachmentAllowed(kind, { allowImages, allowPdf })) {
    return;
  }

  if (kind === "image" && !allowImages) {
    throw new Response(
      JSON.stringify({ error: "This model does not support image attachments." }),
      { status: 400 },
    );
  }

  if (kind === "pdf" && !allowPdf) {
    throw new Response(
      JSON.stringify({ error: "This model does not support PDF attachments." }),
      { status: 400 },
    );
  }

  throw new Response(
    JSON.stringify({ error: "Only image and PDF attachments are supported." }),
    { status: 400 },
  );
}

export async function POST(
  req: Request,
  context: { params: Promise<{ agentId: string; sessionId: string }> },
) {
  try {
    const { agentId, sessionId } = await context.params;

    if (!agentId || !sessionId) {
      return buildErrorResponse(400, "Invalid attachment upload path.");
    }

    if (agentId !== SUPPORTED_AGENT_ID) {
      return buildErrorResponse(404, "Agent not found.");
    }

    const formData = await req.formData();
    const modelIdValue = formData.get("modelId");
    if (typeof modelIdValue !== "string" || modelIdValue.length === 0) {
      return buildErrorResponse(400, "modelId is required");
    }

    let modelConfig;
    try {
      modelConfig = getModelConfig(modelIdValue as ModelId);
    } catch (error) {
      return buildErrorResponse(400, "Unknown model supplied for attachments.");
    }

    const metadataRaw = formData.get("metadata");
    if (typeof metadataRaw !== "string") {
      return buildErrorResponse(400, "Attachment metadata payload missing.");
    }

    let metadataEntries: AttachmentMetadata[] = [];
    try {
      const parsed = JSON.parse(metadataRaw);
      if (!Array.isArray(parsed)) {
        throw new Error("metadata is not an array");
      }
      metadataEntries = parsed as AttachmentMetadata[];
    } catch (error) {
      return buildErrorResponse(400, "Attachment metadata payload invalid JSON.");
    }

    const fileEntries = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    validateAttachmentLimits(fileEntries);

    if (fileEntries.length !== metadataEntries.length) {
      return buildErrorResponse(
        400,
        "Attachment metadata length does not match number of files.",
      );
    }

    await ensurePlanAllowsAttachments(await getUserPlan());

    const allowImages = modelConfig.features.vision;
    const allowPdf = modelConfig.features.pdfSupport;

    const uploads: UploadResult[] = [];

    for (let index = 0; index < fileEntries.length; index++) {
      const file = fileEntries[index];
      const metadata = metadataEntries[index] ?? {};

      if (file.size > MAX_ATTACHMENT_BYTES) {
        return buildErrorResponse(
          400,
          `"${file.name}" is too large. Attachments must be under ${Math.floor(
            MAX_ATTACHMENT_BYTES / (1024 * 1024),
          )}MB.`,
        );
      }

      const inferredMediaType = metadata.mediaType ?? file.type;
      const kind = inferAttachmentKind(inferredMediaType, metadata.filename ?? file.name);

      validateAttachmentKind(kind, allowImages, allowPdf);

      const safeFilename = sanitizeAttachmentFilename(
        metadata.filename ?? file.name ?? `attachment-${index + 1}`,
      );

      const attachmentId = metadata.id && metadata.id.length > 0
        ? metadata.id
        : nanoid();

      const objectPath = `chat/${agentId}/${sessionId}/${nanoid(21)}-${safeFilename}`;

      const resolvedContentType = inferredMediaType && inferredMediaType.length > 0
        ? inferredMediaType
        : kind === "pdf"
          ? PDF_MIME_TYPE
          : kind === "image"
            ? "image/jpeg"
            : "application/octet-stream";

      const putResult = await put(objectPath, file, {
        access: "public",
        contentType: resolvedContentType,
        token: env.BLOB_READ_WRITE_TOKEN,
      });

      const publicUrl = new URL(putResult.pathname, env.BLOB_BASE_URI).toString();

      uploads.push({
        id: attachmentId,
        url: publicUrl,
        storagePath: putResult.pathname,
        size: file.size,
        contentType: resolvedContentType,
        filename: safeFilename,
        metadata: {
          originalFilename: metadata.filename ?? file.name,
          kind,
        },
      });
    }

    return NextResponse.json({
      agentId,
      sessionId,
      attachments: uploads,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("[Attachments Upload] Unexpected error", error);
    return buildErrorResponse(500, "Failed to upload attachments.");
  }
}
