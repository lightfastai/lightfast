"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import { memo } from "react";
import { Streamdown } from "streamdown";
import { CodeBlock, CodeBlockCopyButton } from "./code-block";
import type { Components } from "react-markdown";

type ResponseProps = ComponentProps<typeof Streamdown>;

// Helper to extract code content from children (following Streamdown's approach)
function extractCodeContent(children: ReactNode): string {
	// Check if children is already a string
	if (typeof children === "string") return children;

	// Check if it's a React element with props.children
	if (
		children &&
		typeof children === "object" &&
		"props" in children &&
		children.props &&
		typeof children.props === "object" &&
		"children" in children.props
	) {
		if (typeof children.props.children === "string") {
			return children.props.children;
		}
	}

	// Handle array of children
	if (Array.isArray(children)) {
		return children.map((child: ReactNode) => extractCodeContent(child)).join("");
	}

	return "";
}

// Custom components following Streamdown's structure
const customComponents: Partial<Components> = {
	code: ({ node, className, ...props }) => {
		// Check if it's inline code by checking if node position start and end lines are the same
		// (following Streamdown's approach)
		const isInline = node?.position?.start.line === node?.position?.end.line;

		if (isInline) {
			return (
				<code
					className={cn(
						"rounded bg-muted px-1.5 py-0.5 font-mono text-xs",
						className,
					)}
					{...props}
				/>
			);
		}

		// For code blocks, just pass through className (will be handled by pre)
		return <code className={className} {...props} />;
	},
	pre: ({ node, className, children }) => {
		// Extract language from node properties (following Streamdown's approach)
		let language = "javascript"; // Default language like Streamdown

		if (node?.properties && typeof node.properties.className === "string") {
			language = node.properties.className.replace("language-", "");
		}

		// Extract code content
		let code = "";
		if (typeof children === "string") {
			code = children;
		} else {
			// Use helper to extract code from React elements
			code = extractCodeContent(children as ReactNode);
		}

		// Render using AI Elements CodeBlock (instead of Streamdown's Shiki component)
		return (
			<CodeBlock
				className={cn(" h-auto rounded-lg border", className)}
				code={code}
				language={language}
				showLineNumbers={false}
			>
				<CodeBlockCopyButton />
			</CodeBlock>
		);
	},
};

export const Response = memo(
	({ className, components, ...props }: ResponseProps) => (
		<Streamdown
			className={cn(
				"size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
				className,
			)}
			components={{
				// ...customComponents,
				...components,
			}}
			{...props}
		/>
	),
	(prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = "Response";
