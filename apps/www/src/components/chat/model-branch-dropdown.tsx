"use client";

import { Brain, Eye, FileText, GitBranch, Wrench } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { getModelCapabilities } from "@/lib/ai/capabilities";
import type { ModelConfig, ModelId } from "@lightfast/ai/providers";
import { getVisibleModels } from "@lightfast/ai/providers";
import { Button } from "@lightfast/ui/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@lightfast/ui/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@lightfast/ui/components/ui/tooltip";

// Icon component mapper for capability icons
const CapabilityIcon = ({
	iconName,
	className,
}: { iconName: string; className?: string }) => {
	const iconMap = {
		Eye,
		FileText,
		Wrench,
		Brain,
	} as const;

	const IconComponent = iconMap[iconName as keyof typeof iconMap];
	return IconComponent ? <IconComponent className={className} /> : null;
};

interface ModelBranchDropdownProps {
	onBranch: (modelId: ModelId) => void;
	disabled?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function ModelBranchDropdown({
	onBranch,
	disabled = false,
	onOpenChange,
}: ModelBranchDropdownProps) {
	const [open, setOpen] = useState(false);
	const buttonRef = useRef<HTMLButtonElement>(null);

	// Notify parent when dropdown state changes
	useEffect(() => {
		onOpenChange?.(open);

		// Blur the button when dropdown closes to remove focus state
		if (!open && buttonRef.current) {
			buttonRef.current.blur();
		}
	}, [open, onOpenChange]);

	// Group models by provider
	const modelsByProvider = useMemo(() => {
		const allModels = getVisibleModels();
		return allModels.reduce(
			(acc, model) => {
				if (!acc[model.provider]) {
					acc[model.provider] = [];
				}
				acc[model.provider].push(model);
				return acc;
			},
			{} as Record<string, ModelConfig[]>,
		);
	}, []);

	const handleModelSelect = (modelId: ModelId) => {
		setOpen(false);
		onBranch(modelId);
	};

	// Provider display names
	const providerNames: Record<string, string> = {
		openai: "OpenAI",
		anthropic: "Anthropic",
		openrouter: "OpenRouter",
	};

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 opacity-50 cursor-not-allowed"
					aria-label="Branch from here"
					disabled={true}
				>
					<GitBranch className="h-4 w-4" />
				</Button>
			</TooltipTrigger>
			<TooltipContent side="top">
				<p>We've temporarily disabled this functionality. Check back soon!</p>
			</TooltipContent>
		</Tooltip>
	);
}
