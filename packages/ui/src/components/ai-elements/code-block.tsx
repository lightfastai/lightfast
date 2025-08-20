"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import type { BundledLanguage } from "shiki";
import { codeToHtml } from "shiki";
import { cn } from "@repo/ui/lib/utils";
import { useTheme } from "next-themes";
import { Button } from "@repo/ui/components/ui/button";

interface CodeBlockProps extends HTMLAttributes<HTMLDivElement> {
	code: string;
	language: BundledLanguage;
}

interface CodeBlockContextType {
	code: string;
}

const CodeBlockContext = createContext<CodeBlockContextType>({
	code: "",
});

export async function highlightCode(
	code: string,
	language: BundledLanguage,
	theme: "github-light" | "github-dark" = "github-light",
) {
	return await codeToHtml(code, {
		lang: language,
		theme: theme,
	});
}

export const CodeBlock = ({
	code,
	language,
	className,
	children,
	...props
}: CodeBlockProps) => {
	const [html, setHtml] = useState<string>("");
	const { theme, resolvedTheme } = useTheme();

	useEffect(() => {
		let isMounted = true;

		// Use resolvedTheme to get the actual theme when theme is "system"
		// resolvedTheme will be either "dark" or "light" based on system preference
		const effectiveTheme = theme === "system" ? resolvedTheme : theme;
		const codeTheme = effectiveTheme === "dark" ? "github-dark" : "github-light";

		void highlightCode(code, language, codeTheme).then((result) => {
			if (isMounted) {
				setHtml(result);
			}
		});

		return () => {
			isMounted = false;
		};
	}, [code, language, theme, resolvedTheme]);

	return (
		<CodeBlockContext.Provider value={{ code }}>
			<div className="group relative">
				<div
					className={cn(
						"overflow-x-auto text-xs",
						// Override Shiki's default background styles
						"[&>pre]:!bg-transparent [&>pre]:!p-0",
						className,
					)}
					// biome-ignore lint/security/noDangerouslySetInnerHtml: "this is needed."
					dangerouslySetInnerHTML={{ __html: html }}
					{...props}
				/>
				{children}
			</div>
		</CodeBlockContext.Provider>
	);
};

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
	onCopy?: () => void;
	onError?: (error: Error) => void;
	timeout?: number;
};

export const CodeBlockCopyButton = ({
	onCopy,
	onError,
	timeout = 2000,
	children,
	className,
	...props
}: CodeBlockCopyButtonProps) => {
	const [isCopied, setIsCopied] = useState(false);
	const { code } = useContext(CodeBlockContext);

	const copyToClipboard = async () => {
		try {
			await navigator.clipboard.writeText(code);
			setIsCopied(true);
			onCopy?.();
			setTimeout(() => setIsCopied(false), timeout);
		} catch (error) {
			onError?.(error as Error);
		}
	};

	const Icon = isCopied ? CheckIcon : CopyIcon;

	return (
		<Button
			variant="ghost"
			size="icon"
			className={cn(
				"absolute top-2 right-2 h-8 w-8 opacity-0 transition-all",
				"group-hover:opacity-100",
				className,
			)}
			onClick={copyToClipboard}
			type="button"
			{...props}
		>
			{children ?? <Icon className="h-4 w-4" />}
		</Button>
	);
};

