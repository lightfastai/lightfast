import { useCallback, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { captureException } from "@sentry/nextjs";
import type { PromptInputAttachmentPayload, PromptInputAttachmentItem } from "@repo/ui/components/ai-elements/prompt-input";
import type { JSONValue } from "ai";
import type { ModelId } from "~/ai/providers";
import { toast } from "sonner";

interface UploadedAttachment {
	id: string;
	url: string;
	storagePath: string;
	size: number;
	contentType: string;
	filename?: string;
	metadata: Record<string, JSONValue> | null;
}

interface UseAttachmentUploadOptions {
	agentId: string;
	sessionId: string;
	selectedModelId: ModelId;
}

/**
 * Hook for managing file attachment uploads in chat.
 * Handles upload state, file processing, and integration with Vercel Blob storage.
 */
export function useAttachmentUpload({
	agentId,
	sessionId,
	selectedModelId,
}: UseAttachmentUploadOptions) {
	const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
	const attachmentUploadCounterRef = useRef(0);

	const uploadAttachments = useCallback(
		async (input: {
			attachments: PromptInputAttachmentPayload[];
			modelId: ModelId;
		}): Promise<UploadedAttachment[]> => {
			if (input.attachments.length === 0) {
				return [];
			}

			const formData = new FormData();
			formData.append("modelId", input.modelId);

			const metadataPayload = input.attachments.map((attachment, index) => {
				if (!attachment.file) {
					throw new Error("Attachment file missing for upload.");
				}
				const providedFilename =
					typeof attachment.filename === "string" && attachment.filename.length > 0
						? attachment.filename
						: undefined;
				const fallbackName =
					attachment.file.name && attachment.file.name.length > 0
						? attachment.file.name
						: `attachment-${index + 1}`;

				return {
					id: attachment.id,
					mediaType: attachment.mediaType,
					filename: providedFilename ?? fallbackName,
					size: attachment.size ?? attachment.file.size,
				};
			});

			formData.append("metadata", JSON.stringify(metadataPayload));

			input.attachments.forEach((attachment, index) => {
				if (!attachment.file) {
					throw new Error("Attachment file missing for upload.");
				}
				const metadataEntry = metadataPayload[index];
				const fallbackName =
					attachment.file.name && attachment.file.name.length > 0
						? attachment.file.name
						: `attachment-${index + 1}`;
				const inferredName =
					metadataEntry?.filename && metadataEntry.filename.length > 0
						? metadataEntry.filename
						: fallbackName;

				formData.append("files", attachment.file, inferredName);
			});

			const response = await fetch(
				`/api/v/${agentId}/${sessionId}/attachments`,
				{
					method: "POST",
					body: formData,
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					errorText || "Unable to upload attachments. Please try again.",
				);
			}

			const data = (await response.json()) as {
				attachments: UploadedAttachment[];
			};

			return data.attachments;
		},
		[agentId, sessionId],
	);

	const handleAttachmentUpload = useCallback(
		async (file: File): Promise<PromptInputAttachmentItem | null> => {
			attachmentUploadCounterRef.current += 1;
			setIsUploadingAttachments(true);

			try {
				const attachmentId = nanoid();
				const uploads = await uploadAttachments({
					attachments: [
						{
							id: attachmentId,
							file,
							mediaType: file.type,
							filename: file.name,
							size: file.size,
						},
					],
					modelId: selectedModelId,
				});

				const uploaded = uploads[0];
				if (!uploaded) {
					throw new Error("Attachment upload failed.");
				}

				return {
					type: "file",
					id: uploaded.id,
					url: uploaded.url,
					mediaType: uploaded.contentType,
					filename: uploaded.filename ?? file.name,
					size: uploaded.size,
					storagePath: uploaded.storagePath,
					contentType: uploaded.contentType,
					metadata: uploaded.metadata ?? null,
				};
			} catch (error) {
				const safeError = error instanceof Error ? error : new Error(String(error));
				// Show toast error directly
				toast.error("Upload failed", {
					description: safeError.message || `Unable to upload "${file.name}". Please try again.`,
					duration: 5000,
				});
				captureException(safeError, {
					contexts: {
						attachment: {
							filename: file.name,
							size: file.size,
							modelId: selectedModelId,
						},
					},
				});
				throw safeError;
			} finally {
				attachmentUploadCounterRef.current = Math.max(
					0,
					attachmentUploadCounterRef.current - 1,
				);
				if (attachmentUploadCounterRef.current === 0) {
					setIsUploadingAttachments(false);
				}
			}
		},
		[
			uploadAttachments,
			selectedModelId,
		],
	);

	return {
		uploadAttachments,
		handleAttachmentUpload,
		isUploadingAttachments,
	};
}
