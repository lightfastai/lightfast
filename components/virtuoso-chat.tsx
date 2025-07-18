"use client";

import {
	VirtuosoMessageList,
	VirtuosoMessageListLicense,
	type VirtuosoMessageListMethods,
	type VirtuosoMessageListProps,
} from "@virtuoso.dev/message-list";
import * as React from "react";
import { Markdown } from "@/components/markdown";
import { ThinkingAnimation } from "@/components/thinking-animation";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";
import { isTextPart, isToolPart } from "@/types/lightfast-ui-messages";

interface VirtuosoMessage {
	key: string;
	message: LightfastUIMessage;
	isLoading?: boolean;
	isLastMessage?: boolean;
}

interface VirtuosoChatProps {
	messages: LightfastUIMessage[];
	isLoading: boolean;
	licenseKey?: string;
}

const ItemContent: VirtuosoMessageListProps<VirtuosoMessage, null>["ItemContent"] = ({ data }) => {
	const { message, isLoading, isLastMessage } = data;

	// For user messages, just show the text content
	if (message.role === "user") {
		const textContent =
			message.parts
				?.filter(isTextPart)
				.map((part) => part.text)
				.join("\n") || "";

		return (
			<div className={`px-6 ${isLastMessage ? "pb-20" : "pb-12"}`}>
				<div className="mx-auto max-w-3xl flex justify-end">
					<div className="max-w-[80%] border border-muted/30 rounded-xl px-4 py-1 bg-transparent dark:bg-input/30">
						<p className="whitespace-pre-wrap">{textContent}</p>
					</div>
				</div>
			</div>
		);
	}

	// For assistant messages, render parts in order
	return (
		<div className={`px-6 ${isLastMessage ? "pb-20" : "pb-12"}`}>
			<div className="mx-auto max-w-3xl space-y-4">
				{/* Show thinking/done indicator at the top of assistant messages */}
				{message.role === "assistant" && (
					<div className="flex justify-start items-center gap-3">
						{isLoading ? (
							<>
								<ThinkingAnimation />
								<span className="text-sm text-muted-foreground">Thinking</span>
							</>
						) : (
							<>
								<div className="w-3 h-3 rounded-sm bg-muted" />
								<span className="text-sm text-muted-foreground">Done</span>
							</>
						)}
					</div>
				)}

				{message.parts?.map((part, index) => {
					// Text part
					if (isTextPart(part)) {
						return (
							<div key={`${message.id}-part-${index}`} className="flex justify-start">
								<div className="max-w-[80%]">
									<Markdown>{part.text}</Markdown>
								</div>
							</div>
						);
					}

					// Tool part (e.g., "tool-webSearch", "tool-fileWrite")
					if (isToolPart(part)) {
						const toolName = part.type.replace("tool-", "");
						// biome-ignore lint/suspicious/noExplicitAny: Tool part types are complex and evolving
						const toolPart = part as any;

						// Determine the state and styling based on it
						const getStateStyles = () => {
							switch (toolPart.state) {
								case "input-streaming":
									return {
										bg: "bg-yellow-50 dark:bg-yellow-950",
										border: "border-yellow-200 dark:border-yellow-800",
										text: "text-yellow-700 dark:text-yellow-300",
										icon: "text-yellow-600 dark:text-yellow-400",
										label: "Streaming...",
									};
								case "input-available":
									return {
										bg: "bg-blue-50 dark:bg-blue-950",
										border: "border-blue-200 dark:border-blue-800",
										text: "text-blue-700 dark:text-blue-300",
										icon: "text-blue-600 dark:text-blue-400",
										label: "Calling",
									};
								case "output-available":
									return {
										bg: "bg-green-50 dark:bg-green-950",
										border: "border-green-200 dark:border-green-800",
										text: "text-green-700 dark:text-green-300",
										icon: "text-green-600 dark:text-green-400",
										label: "Complete",
									};
								case "output-error":
									return {
										bg: "bg-red-50 dark:bg-red-950",
										border: "border-red-200 dark:border-red-800",
										text: "text-red-700 dark:text-red-300",
										icon: "text-red-600 dark:text-red-400",
										label: "Error",
									};
								default:
									return {
										bg: "bg-gray-50 dark:bg-gray-950",
										border: "border-gray-200 dark:border-gray-800",
										text: "text-gray-700 dark:text-gray-300",
										icon: "text-gray-600 dark:text-gray-400",
										label: "Unknown",
									};
							}
						};

						const styles = getStateStyles();

						return (
							<div key={`${message.id}-part-${index}`} className="flex justify-start">
								<div className={`max-w-[80%] ${styles.bg} border ${styles.border} rounded-lg px-3 py-2 text-sm`}>
									<div className="flex items-center gap-2">
										<svg
											className={`w-4 h-4 ${styles.icon}`}
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											role="img"
											aria-label={`Tool ${toolName} status: ${styles.label}`}
										>
											{toolPart.state === "output-error" ? (
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
												/>
											) : toolPart.state === "output-available" ? (
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
												/>
											) : (
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
												/>
											)}
										</svg>
										<span className={`font-medium ${styles.text}`}>{toolName}</span>
										<span className={`text-xs ${styles.icon}`}>{styles.label}</span>
										{toolPart.toolCallId && <span className={`text-xs ${styles.icon}`}>#{toolPart.toolCallId}</span>}
									</div>

									{/* Show input */}
									{toolPart.input && (
										<div className={`mt-1 text-xs ${styles.icon} font-mono overflow-x-auto`}>
											<div className="font-semibold">Input:</div>
											<pre>{JSON.stringify(toolPart.input, null, 2)}</pre>
										</div>
									)}

									{/* Show output if available */}
									{toolPart.state === "output-available" && toolPart.output && (
										<div className={`mt-2 text-xs ${styles.icon}`}>
											<div className="font-semibold">Output:</div>
											<pre className="mt-1">
												{typeof toolPart.output === "string"
													? toolPart.output
													: JSON.stringify(toolPart.output, null, 2)}
											</pre>
										</div>
									)}

									{/* Show error if available */}
									{toolPart.state === "output-error" && toolPart.errorText && (
										<div className={`mt-2 text-xs ${styles.icon}`}>
											<div className="font-semibold">Error:</div>
											<div className="mt-1">{toolPart.errorText}</div>
										</div>
									)}
								</div>
							</div>
						);
					}

					// Unknown part type
					return null;
				})}
			</div>
		</div>
	);
};

export function VirtuosoChat({ messages, isLoading, licenseKey = "" }: VirtuosoChatProps) {
	const virtuoso = React.useRef<VirtuosoMessageListMethods<VirtuosoMessage>>(null);
	const prevMessagesLength = React.useRef(0);
	const [isAtBottom, setIsAtBottom] = React.useState(true);

	// Auto-scroll to bottom when new messages are added
	React.useEffect(() => {
		if (!virtuoso.current) return;

		// Convert messages to Virtuoso format
		const virtuosoMessages = messages.map((message, index) => {
			const isLastAssistantMessage = message.role === "assistant" && messages[messages.length - 1]?.id === message.id;
			const isLastMessage = index === messages.length - 1;

			return {
				key: message.id || `message-${index}`,
				message,
				isLoading: isLastAssistantMessage && isLoading,
				isLastMessage,
			};
		});

		// If this is the first load or messages were cleared, set initial data
		if (prevMessagesLength.current === 0 && virtuosoMessages.length > 0) {
			virtuoso.current.data.replace(virtuosoMessages);
		}
		// If new messages were added, append them
		else if (virtuosoMessages.length > prevMessagesLength.current) {
			const newMessages = virtuosoMessages.slice(prevMessagesLength.current);
			virtuoso.current.data.append(newMessages, ({ scrollInProgress, atBottom }) => {
				// Only auto-scroll if user is at bottom or scrolling
				if (atBottom || scrollInProgress || isAtBottom) {
					return {
						index: "LAST",
						align: "start",
						behavior: "smooth",
					};
				}
				return false;
			});
		}
		// If messages were modified (e.g., loading state changed), update them
		else if (virtuosoMessages.length === prevMessagesLength.current) {
			virtuoso.current.data.map((message) => {
				const updated = virtuosoMessages.find((m) => m.key === message.key);
				return updated || message;
			}, "smooth");
		}

		prevMessagesLength.current = virtuosoMessages.length;
	}, [messages, isLoading, isAtBottom]);

	return (
		<VirtuosoMessageListLicense licenseKey={licenseKey}>
			<VirtuosoMessageList<VirtuosoMessage, null>
				ref={virtuoso}
				className="h-full w-full"
				computeItemKey={({ data }) => data.key}
				ItemContent={ItemContent}
			/>
		</VirtuosoMessageListLicense>
	);
}
