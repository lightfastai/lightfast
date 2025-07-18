"use client";

import { ArrowUp } from "lucide-react";
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

interface ChatInputProps {
	onSendMessage: (message: string) => Promise<void> | void;
	placeholder?: string;
	disabled?: boolean;
	maxLength?: number;
	className?: string;
	value?: string;
	onChange?: (value: string) => void;
}

const ChatInputComponent = forwardRef<HTMLTextAreaElement, ChatInputProps>(
	(
		{
			onSendMessage,
			placeholder = "How can I help you today?",
			disabled = false,
			maxLength = 4000,
			className = "",
			value,
			onChange,
		},
		ref,
	) => {
		const [internalMessage, setInternalMessage] = useState("");

		// Use controlled value if provided, otherwise use internal state
		const message = value !== undefined ? value : internalMessage;
		const setMessage = value !== undefined ? onChange || (() => {}) : setInternalMessage;
		const [isSending, setIsSending] = useState(false);
		const textareaRef = useRef<HTMLTextAreaElement>(null);

		// Adjust textarea height based on content
		const adjustTextareaHeight = useCallback(() => {
			const textarea = textareaRef.current;
			if (!textarea) return;

			// Reset height to get accurate scrollHeight
			textarea.style.height = "auto";
			// Let textarea grow naturally, container will handle overflow
			textarea.style.height = `${textarea.scrollHeight}px`;
		}, []);

		// biome-ignore lint/correctness/useExhaustiveDependencies: message dependency is intentional for textarea height adjustment
		useEffect(() => {
			adjustTextareaHeight();
		}, [message, adjustTextareaHeight]);

		// Auto-focus the textarea when component mounts
		useEffect(() => {
			textareaRef.current?.focus();
		}, []);

		// Expose the textarea ref for parent components
		useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement, []);

		const handleSendMessage = useCallback(async () => {
			if (!message.trim() || disabled || isSending) return;

			setIsSending(true);
			const currentMessage = message;
			setMessage("");

			try {
				await onSendMessage(currentMessage);
			} catch (error) {
				console.error("Error sending message:", error);
				// Restore the message on error
				setMessage(currentMessage);
			} finally {
				setIsSending(false);
			}
		}, [message, disabled, isSending, onSendMessage, setMessage]);

		const handleKeyPress = useCallback(
			(e: React.KeyboardEvent) => {
				if (e.key === "Enter" && !e.shiftKey) {
					e.preventDefault();
					handleSendMessage();
				}
			},
			[handleSendMessage],
		);

		const handleMessageChange = useCallback(
			(e: React.ChangeEvent<HTMLTextAreaElement>) => {
				setMessage(e.target.value);
			},
			[setMessage],
		);

		const canSend = message.trim() && !disabled && !isSending;

		return (
			<div className={`pb-2 md:pb-4 flex-shrink-0 ${className}`}>
				<div className="max-w-3xl mx-auto relative">
					<div className="flex gap-2">
						<div className="flex-1 min-w-0">
							{/* Main input container */}
							<div className="w-full border border-border/30 rounded-xl overflow-hidden flex flex-col transition-all bg-transparent dark:bg-input/10">
								{/* Textarea area - grows with content up to max height */}
								<div className="flex-1 max-h-[180px] overflow-y-auto chat-input-scroll">
									<textarea
										ref={textareaRef}
										value={message}
										onChange={handleMessageChange}
										onKeyPress={handleKeyPress}
										placeholder={placeholder}
										className="w-full resize-none border-0 focus-visible:ring-0 whitespace-pre-wrap break-words p-3 bg-transparent dark:bg-input/10 focus:bg-transparent dark:focus:bg-input/10 hover:bg-transparent dark:hover:bg-input/10 disabled:bg-transparent dark:disabled:bg-input/10 outline-none"
										maxLength={maxLength}
										autoComplete="off"
										autoCorrect="off"
										autoCapitalize="off"
										spellCheck="true"
										style={{
											lineHeight: "24px",
											minHeight: "72px",
										}}
									/>
								</div>

								{/* Controls area - always at bottom */}
								<div className="flex items-center justify-end p-2 bg-transparent dark:bg-input/10 transition-[color,box-shadow]">
									{/* Send button */}
									<button
										type="button"
										onClick={handleSendMessage}
										disabled={!canSend}
										className="h-8 w-8 p-0 rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center"
									>
										<ArrowUp className="w-4 h-4" />
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	},
);

// Add display name for debugging
ChatInputComponent.displayName = "ChatInput";

// Memoize the entire component to prevent unnecessary re-renders
export const ChatInput = memo(ChatInputComponent);
