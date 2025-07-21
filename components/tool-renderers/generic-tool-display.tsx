"use client";

import { AlertCircle, CheckCircle2, Loader2, Settings, Sparkles } from "lucide-react";
import { memo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

export interface GenericToolDisplayProps {
	toolPart: any;
	toolName: string;
}

export const GenericToolDisplay = memo(function GenericToolDisplay({ toolPart, toolName }: GenericToolDisplayProps) {
	const state = toolPart.state;
	const error = toolPart.errorText;
	const accordionValue = `tool-${toolName}-${toolPart.toolCallId}`;

	// Get icon based on state
	const getIcon = () => {
		switch (state) {
			case "input-streaming":
				return <Sparkles className="h-4 w-4 animate-pulse text-yellow-500" />;
			case "input-available":
				return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
			case "output-available":
				return <CheckCircle2 className="h-4 w-4 text-green-500" />;
			case "output-error":
				return <AlertCircle className="h-4 w-4 text-red-500" />;
			default:
				return <Settings className="h-4 w-4 text-gray-500" />;
		}
	};

	// Get status label
	const getStatusLabel = () => {
		switch (state) {
			case "input-streaming":
				return "Preparing...";
			case "input-available":
				return "Running...";
			case "output-available":
				return "Complete";
			case "output-error":
				return "Error";
			default:
				return "Unknown";
		}
	};

	// Handle input-streaming state
	if (state === "input-streaming") {
		return (
			<div className="my-2 border rounded-lg px-4 py-3 bg-muted/30">
				<div className="flex items-center gap-2">
					{getIcon()}
					<div className="text-sm">
						<div className="font-medium text-muted-foreground">Preparing {toolName}...</div>
						{toolPart.input && (
							<p className="text-xs text-muted-foreground/70 mt-1">{Object.keys(toolPart.input).length} parameters</p>
						)}
					</div>
				</div>
			</div>
		);
	}

	// Handle error state
	if (state === "output-error") {
		return (
			<div className="my-2">
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						<div className="font-medium">{toolName} failed</div>
						<p className="text-xs mt-2">{error || "An error occurred"}</p>
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	// Main accordion view for other states
	return (
		<div className="my-6 border rounded-lg w-full">
			<Accordion type="single" collapsible className="w-full">
				<AccordionItem value={accordionValue}>
					<AccordionTrigger className="py-3 px-4 hover:no-underline data-[state=closed]:hover:bg-muted/50 items-center">
						<div className="flex items-center gap-2 flex-1">
							<div className="text-left flex-1">
								<div className="font-medium text-xs text-muted-foreground">{toolName}</div>
							</div>
						</div>
					</AccordionTrigger>
					<AccordionContent className="px-4 pb-4">
						{/* Input section */}
						{toolPart.input && (
							<div className="pt-3">
								<h4 className="text-xs font-medium text-muted-foreground mb-2">Input Parameters</h4>
								<div className="bg-muted/50 rounded-md overflow-hidden">
									<ScrollAreaPrimitive.Root className="relative max-h-[300px] overflow-hidden">
										<ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
											<pre className="text-xs font-mono whitespace-pre p-3">
												{JSON.stringify(toolPart.input, null, 2)}
											</pre>
										</ScrollAreaPrimitive.Viewport>
										<ScrollBar orientation="vertical" />
										<ScrollBar orientation="horizontal" />
										<ScrollAreaPrimitive.Corner />
									</ScrollAreaPrimitive.Root>
								</div>
							</div>
						)}

						{/* Output section */}
						{state === "output-available" && toolPart.output && (
							<div className="pt-3">
								<h4 className="text-xs font-medium text-muted-foreground mb-2">Output</h4>
								<div className="bg-muted/50 rounded-md overflow-hidden">
									<ScrollAreaPrimitive.Root className="relative max-h-[300px] overflow-hidden">
										<ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
											<pre className="text-xs font-mono whitespace-pre p-3">
												{typeof toolPart.output === "string" ? toolPart.output : JSON.stringify(toolPart.output, null, 2)}
											</pre>
										</ScrollAreaPrimitive.Viewport>
										<ScrollBar orientation="vertical" />
										<ScrollBar orientation="horizontal" />
										<ScrollAreaPrimitive.Corner />
									</ScrollAreaPrimitive.Root>
								</div>
							</div>
						)}

						{/* Loading state */}
						{state === "input-available" && (
							<div className="pt-3">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Loader2 className="h-3 w-3 animate-spin" />
									<span>Executing {toolName}...</span>
								</div>
							</div>
						)}
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
});
