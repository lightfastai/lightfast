import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { put } from "@vendor/storage";
import { env } from "@vendor/storage/env";
import { auth } from "@clerk/nextjs/server";

import { getModelConfig } from "~/ai/providers";
import type { ModelId } from "~/ai/providers";
import { getUserPlan } from "../../v/[...v]/_lib/user-utils";
import { BILLING_LIMITS } from "~/lib/billing/types";
import type { ClerkPlanKey } from "~/lib/billing/types";
import {
	MAX_ATTACHMENT_BYTES,
	MAX_ATTACHMENT_COUNT,
	PDF_MIME_TYPE,
	ensureAttachmentAllowed,
	inferAttachmentKind,
	sanitizeAttachmentFilename,
} from "@repo/chat-ai-types";
import type { AttachmentKind } from "@repo/chat-ai-types";
import { z } from "zod";

interface AttachmentMetadata {
	id?: string;
	mediaType?: string | null;
	filename?: string | null;
	size?: number | null;
}

interface UploadResult {
	id: string;
	url: string;
	storagePath: string;
	size: number;
	contentType: string;
	filename?: string;
	metadata?: Record<string, unknown> | null;
}

const AttachmentMetadataSchema = z.object({
	id: z.string().optional(),
	mediaType: z.string().nullable().optional(),
	filename: z.string().nullable().optional(),
	size: z.number().nullable().optional(),
});

function buildErrorResponse(status: number, message: string) {
	return NextResponse.json({ error: message }, { status });
}

const planSupportsAttachments = (plan: ClerkPlanKey) =>
	BILLING_LIMITS[plan].hasAttachments;

const getAttachmentLimitError = (files: File[]): string | null => {
	if (files.length === 0) {
		return "No files provided.";
	}

	if (files.length > MAX_ATTACHMENT_COUNT) {
		return `You can attach up to ${MAX_ATTACHMENT_COUNT} files per message.`;
	}

	return null;
};

const getAttachmentKindError = (
	kind: AttachmentKind,
	allowImages: boolean,
	allowPdf: boolean,
): string | null => {
	if (ensureAttachmentAllowed(kind, { allowImages, allowPdf })) {
		return null;
	}

	if (kind === "image" && !allowImages) {
		return "This model does not support image attachments.";
	}

	if (kind === "pdf" && !allowPdf) {
		return "This model does not support PDF attachments.";
	}

	return "Only image and PDF attachments are supported.";
};

export async function POST(req: Request) {
	try {
		// Verify authentication
		const { userId } = await auth();
		if (!userId) {
			return buildErrorResponse(401, "Unauthorized");
		}

		const formData = await req.formData();
		const modelIdValue = formData.get("modelId");
		if (typeof modelIdValue !== "string" || modelIdValue.length === 0) {
			return buildErrorResponse(400, "modelId is required");
		}

		const metadataRaw = formData.get("metadata");
		if (typeof metadataRaw !== "string") {
			return buildErrorResponse(400, "Attachment metadata payload missing.");
		}

		let metadataEntries: AttachmentMetadata[] = [];
		try {
			const parsed: unknown = JSON.parse(metadataRaw);
			const result = z.array(AttachmentMetadataSchema).safeParse(parsed);
			if (!result.success) {
				return buildErrorResponse(400, "Attachment metadata payload invalid JSON.");
			}
			metadataEntries = result.data;
		} catch {
			return buildErrorResponse(400, "Attachment metadata payload invalid JSON.");
		}

		const fileEntries = formData
			.getAll("files")
			.filter((value): value is File => value instanceof File);

		const limitError = getAttachmentLimitError(fileEntries);
		if (limitError) {
			return buildErrorResponse(400, limitError);
		}

		if (fileEntries.length !== metadataEntries.length) {
			return buildErrorResponse(
				400,
				"Attachment metadata length does not match number of files.",
			);
		}

		// Validate total size (defense in depth)
		const totalSize = fileEntries.reduce((sum, file) => sum + file.size, 0);
		const MAX_TOTAL_SIZE = MAX_ATTACHMENT_COUNT * MAX_ATTACHMENT_BYTES;
		if (totalSize > MAX_TOTAL_SIZE) {
			return buildErrorResponse(
				400,
				`Total file size (${Math.floor(totalSize / (1024 * 1024))}MB) exceeds maximum allowed (${Math.floor(MAX_TOTAL_SIZE / (1024 * 1024))}MB).`,
			);
		}

		const plan = await getUserPlan();
		if (!planSupportsAttachments(plan)) {
			return buildErrorResponse(403, "Your plan does not support file attachments.");
		}

		let modelConfig;
		try {
			modelConfig = getModelConfig(modelIdValue as ModelId);
		} catch {
			return buildErrorResponse(400, "Unknown model supplied for attachments.");
		}

		const allowImages = modelConfig.features.vision;
		const allowPdf = modelConfig.features.pdfSupport;

		const uploads: UploadResult[] = [];

		for (const [index, file] of fileEntries.entries()) {
			const metadata = metadataEntries[index];

			if (file.size > MAX_ATTACHMENT_BYTES) {
				return buildErrorResponse(
					400,
					`"${file.name}" is too large. Attachments must be under ${Math.floor(
						MAX_ATTACHMENT_BYTES / (1024 * 1024),
					)}MB.`,
				);
			}

			const metadataMediaType =
				metadata && typeof metadata.mediaType === "string" && metadata.mediaType.length > 0
					? metadata.mediaType
					: undefined;
			const inferredMediaType = metadataMediaType ?? file.type;
			const kind = inferAttachmentKind(
				inferredMediaType,
				metadata && typeof metadata.filename === "string" && metadata.filename.length > 0
					? metadata.filename
					: file.name,
			);

			const kindError = getAttachmentKindError(kind, allowImages, allowPdf);
			if (kindError) {
				return buildErrorResponse(400, kindError);
			}

			const metadataFilename =
				metadata && typeof metadata.filename === "string" && metadata.filename.length > 0
					? metadata.filename
					: undefined;
			const baseFilename = metadataFilename && metadataFilename.length > 0
				? metadataFilename
				: file.name;
			const resolvedFilename =
				baseFilename && baseFilename.length > 0
					? baseFilename
					: `attachment-${index + 1}`;
			const safeFilename = sanitizeAttachmentFilename(resolvedFilename);

			const attachmentId =
				metadata && typeof metadata.id === "string" && metadata.id.length > 0
					? metadata.id
					: nanoid();

			const objectPath = `chat/${userId}/${nanoid(21)}-${safeFilename}`;

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
					originalFilename: metadataFilename ?? file.name,
					kind,
				},
			});
		}

		return NextResponse.json({
			attachments: uploads,
		});
	} catch (error) {
		console.error("[Attachments Upload] Unexpected error", error);
		return buildErrorResponse(500, "Failed to upload attachments.");
	}
}
