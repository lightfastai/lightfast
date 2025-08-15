"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

interface CodeHighlighterProps {
	code: string;
	language?: string;
}

export function CodeHighlighter({
	code,
	language = "typescript",
}: CodeHighlighterProps) {
	const [highlightedCode, setHighlightedCode] = useState<string>("");

	useEffect(() => {
		async function highlightCode() {
			try {
				const html = await codeToHtml(code, {
					lang: language,
					theme: "github-dark",
					transformers: [
						{
							pre(node) {
								// Remove default padding and background from pre
								node.properties.style = "";
								return node;
							},
							code(node) {
								// Remove default padding from code
								node.properties.style = "";
								return node;
							},
						},
					],
				});
				setHighlightedCode(html);
			} catch (error) {
				console.error("Failed to highlight code:", error);
				setHighlightedCode(`<pre><code>${code}</code></pre>`);
			}
		}

		void highlightCode();
	}, [code, language]);

	if (!highlightedCode) {
		return (
			<pre className="bg-card p-4 text-xs">
				<code className="text-muted-foreground">{code}</code>
			</pre>
		);
	}

	return (
		<div
			className="bg-card text-card-foreground p-4 text-xs overflow-x-auto [&_pre]:!bg-transparent [&_code]:!bg-transparent"
			dangerouslySetInnerHTML={{ __html: highlightedCode }}
		/>
	);
}

