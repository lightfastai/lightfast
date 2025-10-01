import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { ChatAppRouter } from "@api/chat";

import { ChatApiError, ChatApiService } from "./base-service";

type ListInput = inferRouterInputs<ChatAppRouter>["attachment"]["list"];
type DeleteInput = inferRouterInputs<ChatAppRouter>["attachment"]["delete"];
type RawListOutput = inferRouterOutputs<ChatAppRouter>["attachment"]["list"];
type RawDeleteOutput = inferRouterOutputs<ChatAppRouter>["attachment"]["delete"];

export type AttachmentsListInput = ListInput;
export type AttachmentsDeleteInput = DeleteInput;
export type AttachmentsListOutput = RawListOutput;
export type AttachmentsDeleteOutput = RawDeleteOutput;

export class AttachmentsService extends ChatApiService {
	async list(): Promise<AttachmentsListOutput> {
		const attachments = await this.call<RawListOutput>(
			"attachments.list",
			(caller) => caller.attachment.list(),
			{
				fallbackMessage: "Failed to fetch attachments",
				suppressCodes: ["NOT_FOUND"],
				recover: (error) => {
					if (error.code === "NOT_FOUND") {
						return [];
					}

					if (error.code === "UNAUTHORIZED") {
						throw new ChatApiError({
							code: "UNAUTHORIZED",
							message: "Unauthorized: User session expired or invalid",
							cause: error,
						});
					}

					throw error;
				},
			},
		);

		return attachments;
	}

	async delete(input: DeleteInput): Promise<AttachmentsDeleteOutput> {
		const result = await this.call<RawDeleteOutput>(
			"attachments.delete",
			(caller) => caller.attachment.delete(input),
			{
				fallbackMessage: "Failed to delete attachment",
				details: { attachmentId: input.attachmentId },
				recover: (error) => {
					switch (error.code) {
						case "UNAUTHORIZED":
							throw new ChatApiError({
								code: "UNAUTHORIZED",
								message: "Unauthorized: User session expired or invalid",
								cause: error,
								details: { attachmentId: input.attachmentId },
							});
						case "NOT_FOUND":
							throw new ChatApiError({
								code: "NOT_FOUND",
								message: "Attachment not found or access denied",
								cause: error,
								details: { attachmentId: input.attachmentId },
							});
						default:
							throw error;
					}
				},
			},
		);

		return result;
	}
}
