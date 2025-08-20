"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ComponentProps } from "react";
import { memo, isValidElement } from "react";
import { Streamdown } from "streamdown";
import { CodeBlock, CodeBlockCopyButton } from "./code-block";
import type { Components } from "react-markdown";
import type { BundledLanguage } from "shiki";

type ResponseProps = ComponentProps<typeof Streamdown>;

// Custom components following Streamdown's structure exactly
const customComponents: Partial<Components> = {
	code: ({ node, className, ...props }) => {
		const inline = node?.position?.start.line === node?.position?.end.line;

		if (!inline) {
			return <code className={className} {...props} />;
		}

		return (
			<code
				className={cn(
					"rounded bg-muted px-1.5 py-0.5 font-mono text-sm",
					className,
				)}
				{...props}
			/>
		);
	},
	pre: ({ node, className, children }) => {
		let language: BundledLanguage = "javascript";

		if (node?.properties && typeof node.properties.className === "string") {
			language = node.properties.className.replace(
				"language-",
				"",
			) as BundledLanguage;
		}

		// Extract code content from children safely
		let code = "";
		if (
			isValidElement(children) &&
			children.props &&
			typeof children.props === "object" &&
			"children" in children.props &&
			typeof children.props.children === "string"
		) {
			code = children.props.children;
		} else if (typeof children === "string") {
			code = children;
		}

		return (
			<CodeBlock
				className={cn(
					"my-4 h-auto rounded-lg border p-4",
					"bg-muted/30 dark:bg-muted/20",
					className,
				)}
				code={code}
				language={language}
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
				...customComponents,
				...components,
			}}
			{...props}
		/>
	),
	(prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = "Response";
