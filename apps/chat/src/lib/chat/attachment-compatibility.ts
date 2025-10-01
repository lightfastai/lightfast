import type { PromptInputAttachmentPayload } from "@repo/ui/components/ai-elements/prompt-input";
import {
	inferAttachmentKind,
	ensureAttachmentAllowed,
} from "@repo/chat-ai-types";
import type { ModelId } from "~/ai/providers";
import { getModelConfig, MODELS } from "~/ai/providers";

export interface IncompatibleFile {
	filename: string;
	reason: "no-vision" | "no-pdf";
}

export interface AttachmentCompatibilityResult {
	isCompatible: boolean;
	incompatibleFiles: IncompatibleFile[];
	suggestedModelId?: ModelId;
	suggestedModelName?: string;
}

/**
 * Check if attachments are compatible with the selected model
 */
export function checkAttachmentCompatibility(
	attachments: PromptInputAttachmentPayload[],
	selectedModelId: ModelId,
): AttachmentCompatibilityResult {
	const modelConfig = getModelConfig(selectedModelId);
	const incompatibleFiles: IncompatibleFile[] = [];

	for (const attachment of attachments) {
		const kind = inferAttachmentKind(
			attachment.mediaType,
			attachment.filename ?? "attachment",
		);

		const allowed = ensureAttachmentAllowed(kind, {
			allowImages: modelConfig.features.vision,
			allowPdf: modelConfig.features.pdfSupport,
		});

		if (!allowed) {
			// Determine the specific reason
			let reason: "no-vision" | "no-pdf";
			if (kind === "pdf" && !modelConfig.features.pdfSupport) {
				reason = "no-pdf";
			} else if (kind === "image" && !modelConfig.features.vision) {
				reason = "no-vision";
			} else {
				// Unknown kind or model doesn't support any attachments
				reason = "no-vision";
			}

			incompatibleFiles.push({
				filename: attachment.filename ?? "attachment",
				reason,
			});
		}
	}

	// If there are incompatible files, suggest a compatible model
	let suggestedModelId: ModelId | undefined;
	let suggestedModelName: string | undefined;

	if (incompatibleFiles.length > 0) {
		const needsPdf = incompatibleFiles.some((f) => f.reason === "no-pdf");
		const needsVision = incompatibleFiles.some((f) => f.reason === "no-vision");

		// Suggest a model that supports the required features
		// Priority: Gemini 2.5 Flash (default) > Gemini 2.5 Pro > Claude 4 Sonnet
		const compatibleModels = Object.entries(MODELS)
			.filter(([, config]) => {
				const modelConfig = config;
				if (needsPdf && !modelConfig.features.pdfSupport) return false;
				if (needsVision && !modelConfig.features.vision) return false;
				return true;
			})
			.map(([id, config]) => {
				const modelConfig = config;
				return {
					id: id as ModelId,
					displayName: modelConfig.displayName,
					// Prefer Gemini 2.5 Flash (default model), then other compatible models
					score:
						(id === "google/gemini-2.5-flash" ? 10 : 0) + // Highest priority
						(modelConfig.features.vision ? 1 : 0) +
						(modelConfig.features.pdfSupport ? 1 : 0) +
						(modelConfig.billingTier === "non_premium" ? 0.5 : 0), // Prefer free tier
				};
			})
			.sort((a, b) => b.score - a.score);

		if (compatibleModels.length > 0 && compatibleModels[0]) {
			suggestedModelId = compatibleModels[0].id;
			suggestedModelName = compatibleModels[0].displayName;
		}
	}

	return {
		isCompatible: incompatibleFiles.length === 0,
		incompatibleFiles,
		suggestedModelId,
		suggestedModelName,
	};
}
