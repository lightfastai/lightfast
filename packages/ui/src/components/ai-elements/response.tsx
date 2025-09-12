"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ComponentProps } from "react";
import { memo, isValidElement, useEffect } from "react";
import { Streamdown } from "streamdown";
import {
	CodeBlock,
	CodeBlockHeader,
	CodeBlockActions,
	CodeBlockContent,
	CodeBlockCopyButton,
} from "./code-block";
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
					"bg-muted/50 rounded-md px-1 py-0.5 text-xs font-mono",
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
					"my-4 h-auto rounded-md border border-border",
					"bg-muted/50 dark:bg-muted/20",
					className,
				)}
			>
				<CodeBlockHeader language={language}>
					<CodeBlockActions>
						<CodeBlockCopyButton />
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent code={code} language={language} className="p-3" />
			</CodeBlock>
		);
	},
	// Typography components
	strong: ({ children, ...props }) => {
		return (
			<strong className="font-semibold" {...props}>
				{children}
			</strong>
		);
	},
	em: ({ children, ...props }) => {
		return (
			<em className="italic" {...props}>
				{children}
			</em>
		);
	},
	// Link component
	a: ({ href, children, ...props }) => {
		const isExternal = href?.startsWith("http");
		return (
			<a
				href={href}
				className="text-blue-500 hover:text-blue-600 underline underline-offset-2 transition-colors"
				target={isExternal ? "_blank" : undefined}
				rel={isExternal ? "noopener noreferrer" : undefined}
				{...props}
			>
				{children}
			</a>
		);
	},
	// Heading components with consistent styling
	h1: ({ children, ...props }) => {
		return (
			<h1
				className="scroll-m-20 text-xl font-bold tracking-tight mb-4 mt-6 first:mt-0"
				{...props}
			>
				{children}
			</h1>
		);
	},
	h2: ({ children, ...props }) => {
		return (
			<h2
				className="scroll-m-20 text-lg font-semibold tracking-tight mb-3 mt-5"
				{...props}
			>
				{children}
			</h2>
		);
	},
	h3: ({ children, ...props }) => {
		return (
			<h3
				className="scroll-m-20 text-base font-semibold tracking-tight mb-2 mt-4"
				{...props}
			>
				{children}
			</h3>
		);
	},
	h4: ({ children, ...props }) => {
		return (
			<h4
				className="scroll-m-20 text-sm font-semibold tracking-tight mb-2 mt-3"
				{...props}
			>
				{children}
			</h4>
		);
	},
	h5: ({ children, ...props }) => {
		return (
			<h5
				className="scroll-m-20 text-xs font-semibold tracking-tight mb-1 mt-2"
				{...props}
			>
				{children}
			</h5>
		);
	},
	h6: ({ children, ...props }) => {
		return (
			<h6
				className="scroll-m-20 text-xs font-semibold tracking-tight mb-1 mt-2"
				{...props}
			>
				{children}
			</h6>
		);
	},
	// Paragraph with proper spacing
	p: ({ children, ...props }) => {
		return (
			<p
				className="text-sm leading-7 [&:not(:first-child)]:mt-3 break-words"
				{...props}
			>
				{children}
			</p>
		);
	},
	// List components
	ul: ({ className, children, ...props }) => {
		return (
			<ul
				className={cn("my-3 ml-6 list-disc [&>li]:mt-1", className)}
				{...props}
			>
				{children}
			</ul>
		);
	},
	ol: ({ className, children, ...props }) => {
		return (
			<ol
				className={cn("my-3 ml-6 list-decimal [&>li]:mt-1", className)}
				{...props}
			>
				{children}
			</ol>
		);
	},
	li: ({ className, children, ...props }) => {
		return (
			<li className={cn("text-sm leading-7 break-words", className)} {...props}>
				{children}
			</li>
		);
	},
	// Horizontal rule
	hr: ({ ...props }) => {
		return <hr className="my-6 border-border" {...props} />;
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
