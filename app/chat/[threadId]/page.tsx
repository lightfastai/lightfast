"use client";

import { useChat } from "@ai-sdk/react";
import { use, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatTransport } from "@/hooks/use-chat-transport";
import { ChatInput } from "@/src/components/chat-input";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";
import { isTextPart, isToolPart } from "@/types/lightfast-ui-messages";

interface ChatPageProps {
	params: Promise<{
		threadId: string;
	}>;
}

export default function ChatPage({ params }: ChatPageProps) {
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const { threadId } = use(params);

	// Create transport for AI SDK v5
	const transport = useChatTransport({ threadId });

	// Use the chat hook with transport and LightfastUIMessage type
	const {
		messages = [],
		sendMessage: vercelSendMessage,
		status,
	} = useChat<LightfastUIMessage>({
		id: threadId,
		transport,
		onError: (error) => {
			console.error("Chat error:", error);
		},
	});

	const isLoading = status === "streaming" || status === "submitted";

	// Debug: Log messages to see their structure
	useEffect(() => {
		console.log("Messages:", messages);
		messages.forEach((msg, index) => {
			console.log(`Message ${index}:`, {
				id: msg.id,
				role: msg.role,
				parts: msg.parts,
			});
		});
	}, [messages]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: messages dependency is intentional for scrolling
	useEffect(() => {
		if (scrollAreaRef.current) {
			scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
		}
	}, [messages]);

	return (
		<main className="flex h-screen flex-col">
			<header className="px-6 py-4">
				<div className="flex items-center justify-between">
					<h1 className="text-xs text-muted-foreground">This is an experiment by Lightfast. Use with discretion.</h1>
				</div>
			</header>

			{messages.length === 0 ? (
				// Center the chat input when no messages
				<div className="flex-1 flex items-center justify-center p-6">
					<div className="w-full max-w-3xl">
						<div className="mb-6">
							<h1 className="text-3xl font-medium mb-2">Hello.</h1>
							<p className="text-3xl text-muted-foreground">What can I do for you?</p>
						</div>
						<ChatInput
							onSendMessage={async (message) => {
								if (!message.trim() || isLoading) return;

								try {
									// Generate IDs for the messages
									const userMessageId = `user-${Date.now()}`;
									const assistantMessageId = `assistant-${Date.now()}`;

									// Use vercelSendMessage with the correct AI SDK v5 format
									await vercelSendMessage(
										{
											role: "user",
											parts: [{ type: "text", text: message }],
											id: userMessageId,
										},
										{
											body: {
												id: assistantMessageId,
												userMessageId,
												threadClientId: threadId,
											},
										},
									);
								} catch (error) {
									console.error("Error sending message:", error);
									throw error; // Re-throw to let ChatInput handle error state
								}
							}}
							placeholder="Type your message..."
							disabled={isLoading}
						/>
					</div>
				</div>
			) : (
				// Normal layout with messages and bottom input
				<>
					<ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
						<div className="mx-auto max-w-4xl space-y-4">
							{messages.map((message) => {
						// For user messages, just show the text content
						if (message.role === "user") {
							const textContent =
								message.parts
									?.filter(isTextPart)
									.map((part) => part.text)
									.join("\n") || "";

							return (
								<div key={message.id} className="flex justify-end">
									<div className="max-w-[80%] rounded-lg px-4 py-2 bg-primary text-primary-foreground">
										<p className="whitespace-pre-wrap">{textContent}</p>
									</div>
								</div>
							);
						}

						// For assistant messages, render parts in order
						return (
							<div key={message.id} className="space-y-2">
								{message.parts?.map((part, index) => {
									// Text part
									if (isTextPart(part)) {
										return (
											<div key={`${message.id}-part-${index}`} className="flex justify-start">
												<div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
													<p className="whitespace-pre-wrap">{part.text}</p>
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
												<div
													className={`max-w-[80%] ${styles.bg} border ${styles.border} rounded-lg px-3 py-2 text-sm`}
												>
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
														{toolPart.toolCallId && (
															<span className={`text-xs ${styles.icon}`}>#{toolPart.toolCallId}</span>
														)}
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
						);
					})}
					{isLoading && (
						<div className="flex justify-start">
							<div className="bg-muted rounded-lg px-4 py-2">
								<div className="flex space-x-1">
									<div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
									<div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:100ms]" />
									<div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:200ms]" />
								</div>
							</div>
						</div>
					)}
						</div>
					</ScrollArea>

					<ChatInput
						onSendMessage={async (message) => {
							if (!message.trim() || isLoading) return;

							try {
								// Generate IDs for the messages
								const userMessageId = `user-${Date.now()}`;
								const assistantMessageId = `assistant-${Date.now()}`;

								// Use vercelSendMessage with the correct AI SDK v5 format
								await vercelSendMessage(
									{
										role: "user",
										parts: [{ type: "text", text: message }],
										id: userMessageId,
									},
									{
										body: {
											id: assistantMessageId,
											userMessageId,
											threadClientId: threadId,
										},
									},
								);
							} catch (error) {
								console.error("Error sending message:", error);
								throw error; // Re-throw to let ChatInput handle error state
							}
						}}
						placeholder="Type your message..."
						disabled={isLoading}
					/>
				</>
			)}
		</main>
	);
}
