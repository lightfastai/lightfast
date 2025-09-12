"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { cn } from "../../lib/utils";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { createContext, memo, useContext, useEffect, useState } from "react";
import { Response } from "./response";

type ReasoningContextValue = {
	isStreaming: boolean;
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	duration: number;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

const useReasoning = () => {
	const context = useContext(ReasoningContext);
	if (!context) {
		throw new Error("Reasoning components must be used within Reasoning");
	}
	return context;
};

export type ReasoningProps = ComponentProps<
	typeof CollapsiblePrimitive.Root
> & {
	isStreaming?: boolean;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	duration?: number;
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

export const Reasoning = memo(
	({
		className,
		isStreaming = false,
		open,
		defaultOpen = true,
		onOpenChange,
		duration: durationProp,
		children,
		...props
	}: ReasoningProps) => {
		const [isOpen, setIsOpen] = useControllableState({
			prop: open,
			defaultProp: defaultOpen,
			onChange: onOpenChange,
		});
		const [duration, setDuration] = useControllableState({
			prop: durationProp,
			defaultProp: 0,
		});

		const [hasAutoClosed, setHasAutoClosed] = useState(false);
		const [startTime, setStartTime] = useState<number | null>(null);

		// Track duration when streaming starts and ends
		useEffect(() => {
			if (isStreaming) {
				if (startTime === null) {
					setStartTime(Date.now());
				}
			} else if (startTime !== null) {
				setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S));
				setStartTime(null);
			}
		}, [isStreaming, startTime, setDuration]);

		// Auto-open when streaming starts, auto-close when streaming ends (once only)
		useEffect(() => {
			if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
				// Add a small delay before closing to allow user to see the content
				const timer = setTimeout(() => {
					setIsOpen(false);
					setHasAutoClosed(true);
				}, AUTO_CLOSE_DELAY);

				return () => clearTimeout(timer);
			}
		}, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosed]);

		const handleOpenChange = (newOpen: boolean) => {
			setIsOpen(newOpen);
		};

		return (
			<ReasoningContext.Provider
				value={{ isStreaming, isOpen, setIsOpen, duration }}
			>
				<CollapsiblePrimitive.Root
					className={cn("not-prose mb-4", className)}
					onOpenChange={handleOpenChange}
					open={isOpen}
					{...props}
				>
					{children}
				</CollapsiblePrimitive.Root>
			</ReasoningContext.Provider>
		);
	},
);

export type ReasoningTriggerProps = ComponentProps<
	typeof CollapsiblePrimitive.Trigger
>;

const getThinkingMessage = (isStreaming: boolean, duration?: number) => {
	if (isStreaming || duration === 0) {
		return <span className="text-xs">Reasoning</span>;
	}
	if (duration === undefined) {
		return <span className="text-xs">Reasoning</span>;
	}
	return <span className="text-xs">Reasoning</span>;
};

export const ReasoningTrigger = memo(
	({ className, children, ...props }: ReasoningTriggerProps) => {
		const { isStreaming, isOpen, duration } = useReasoning();

		return (
			<CollapsiblePrimitive.Trigger
				className={cn(
					"flex w-full items-center gap-2 text-muted-foreground text-xs transition-colors hover:text-foreground",
					className,
				)}
				{...props}
			>
				{children ?? (
					<>
						<BrainIcon className="size-4" />
						{getThinkingMessage(isStreaming, duration)}
						<ChevronDownIcon
							className={cn(
								"size-4 transition-transform",
								isOpen ? "rotate-180" : "rotate-0",
							)}
						/>
					</>
				)}
			</CollapsiblePrimitive.Trigger>
		);
	},
);

export type ReasoningContentProps = ComponentProps<
	typeof CollapsiblePrimitive.Content
> & {
	children: string;
};

export const ReasoningContent = memo(
	({ className, children, ...props }: ReasoningContentProps) => (
		<CollapsiblePrimitive.Content
			className={cn(
				"mt-4 text-xs",
				"data-[state=closed]:fade-out-0 px-4 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
				className,
			)}
			{...props}
		>
			<Response className="grid gap-2">{children}</Response>
		</CollapsiblePrimitive.Content>
	),
);

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";

