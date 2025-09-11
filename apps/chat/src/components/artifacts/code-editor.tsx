"use client";

import {
	CodeBlock,
	CodeBlockContent,
} from "@repo/ui/components/ai-elements/code-block";
import type { BundledLanguage } from "shiki";
import { memo } from "react";

interface EditorProps {
	content: string;
	status: "streaming" | "idle";
	isCurrentVersion: boolean;
	currentVersionIndex: number;
}

// Helper function to detect language from content or default to typescript
function detectLanguage(content: string): BundledLanguage {
	// Simple heuristics to detect language
	if (content.includes('def ') && content.includes('import ')) return 'python';
	if (content.includes('function ') || content.includes('const ') || content.includes('let ')) return 'typescript';
	if (content.includes('package ') && content.includes('func ')) return 'go';
	if (content.includes('pub fn ') || content.includes('fn main()')) return 'rust';
	if (content.includes('<html') || content.includes('<!DOCTYPE')) return 'html';
	if (content.includes('SELECT ') || content.includes('INSERT ')) return 'sql';
	
	// Default to typescript for most cases
	return 'typescript';
}

function PureCodeEditor({ content }: EditorProps) {
	const language = detectLanguage(content);
	
	return (
		<div className="not-prose relative w-full h-full overflow-auto">
			<CodeBlock className="bg-background">
				<CodeBlockContent code={content} language={language} className="p-4" />
			</CodeBlock>
		</div>
	);
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
	if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex)
		return false;
	if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) return false;
	if (prevProps.status === "streaming" && nextProps.status === "streaming")
		return false;
	if (prevProps.content !== nextProps.content) return false;

	return true;
}

export const CodeEditor = memo(PureCodeEditor, areEqual);

