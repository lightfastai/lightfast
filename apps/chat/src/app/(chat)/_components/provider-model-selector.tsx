"use client";

import {
	PROVIDER_ICONS,
	getModelConfig,
	getVisibleModels,
	getProviderDisplayName,
} from "~/ai/providers";
import type { ModelId } from "~/ai/providers";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@repo/ui/components/ui/command";
import { Icons } from "@repo/ui/components/ui/icons";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown, Lock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface ProviderModelSelectorProps {
	value: ModelId;
	onValueChange: (value: ModelId) => void;
	disabled?: boolean;
	className?: string;
	isAuthenticated?: boolean;
}

const featureBadges = {
	vision: {
		label: "Vision",
		className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
	},
	functionCalling: {
		label: "Tools",
		className: "bg-green-500/10 text-green-600 dark:text-green-400",
	},
	thinking: {
		label: "Reasoning",
		className: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
	},
	pdfSupport: {
		label: "PDF",
		className: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
	},
};

export function ProviderModelSelector({
	value,
	onValueChange,
	disabled,
	className,
	isAuthenticated = false,
}: ProviderModelSelectorProps) {
	const [open, setOpen] = useState(false);
	const [hoveredModel, setHoveredModel] = useState<ModelId | null>(null);

	// Get all visible models with accessibility info
	const allModels = useMemo(() => {
		return getVisibleModels().map((model) => ({
			id: model.id as ModelId,
			provider: model.provider,
			iconProvider: model.iconProvider,
			displayName: model.displayName,
			description: model.description,
			features: model.features,
			accessLevel: model.accessLevel,
			isAccessible: isAuthenticated || model.accessLevel === "anonymous",
		}));
	}, [isAuthenticated]);

	// Sort models with selected one first
	const sortedModels = useMemo(() => {
		return [...allModels].sort((a, b) => {
			if (a.id === value) return -1;
			if (b.id === value) return 1;
			return 0;
		});
	}, [allModels, value]);

	// Get the model to show details for (hovered or selected)
	const detailModel = useMemo(() => {
		const modelId = hoveredModel ?? value;
		return allModels.find((m) => m.id === modelId) ?? null;
	}, [hoveredModel, value, allModels]);

	// Reset hover when opening
	useEffect(() => {
		if (open) {
			setHoveredModel(null);
		}
	}, [open]);

	const handleSelect = useCallback(
		(modelId: string) => {
			// Check if model is accessible
			const model = allModels.find((m) => m.id === modelId);
			if (!model?.isAccessible) {
				return; // Don't select inaccessible models
			}
			onValueChange(modelId as ModelId);
			setOpen(false);
		},
		[onValueChange, allModels],
	);

	// Global keyboard shortcut for Cmd/Ctrl + .
	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === ".") {
				e.preventDefault();
				setOpen(true);
			}
		};

		document.addEventListener("keydown", handleGlobalKeyDown);
		return () => document.removeEventListener("keydown", handleGlobalKeyDown);
	}, []);

	const selectedModel = getModelConfig(value);

	return (
		<Popover open={open} onOpenChange={setOpen} modal={false}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={cn(
						"justify-between rounded-full dark:border-border/30 dark:shadow-sm",
						className,
					)}
					disabled={disabled}
				>
					<div className="flex items-center gap-2">
						{(() => {
							const iconName = PROVIDER_ICONS[
								selectedModel.iconProvider
							] as keyof typeof Icons;
							const IconComponent = Icons[iconName];
							return <IconComponent className="w-4 h-4 shrink-0" />;
						})()}
						<span className="truncate text-xs">
							{selectedModel.displayName}
						</span>
					</div>
					<ChevronDown className="h-3 w-3 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-[500px] p-0 rounded-2xl overflow-hidden"
			>
				<div className="flex h-[300px]">
					{/* Model list */}
					<div className="flex-1 border-r flex flex-col">
						<Command className="flex flex-col border-0">
							<CommandInput
								placeholder="Search models..."
								className="text-xs"
								autoFocus
							/>
							<CommandList className="h-full">
								<CommandEmpty className="text-xs text-muted-foreground p-2">
									No models found
								</CommandEmpty>
								{sortedModels.map((model) => (
									<CommandItem
										key={model.id}
										value={model.id}
										keywords={[model.displayName, model.iconProvider]}
										onSelect={handleSelect}
										onMouseEnter={() => setHoveredModel(model.id)}
										disabled={!model.isAccessible}
										className={cn(
											"flex items-center gap-3 px-2.5 py-2 text-xs rounded-none",
											model.id === value && "bg-accent text-accent-foreground",
											!model.isAccessible && "opacity-50 cursor-not-allowed",
											model.isAccessible && "cursor-pointer",
										)}
									>
										{(() => {
											const iconName = PROVIDER_ICONS[
												model.iconProvider
											] as keyof typeof Icons;
											const IconComponent = Icons[iconName];
											return <IconComponent className="w-4 h-4 shrink-0" />;
										})()}
										<span className="truncate text-xs">
											{model.displayName}
										</span>
										<div className="ml-auto flex items-center gap-2">
											{!model.isAccessible && (
												<Lock className="w-3 h-3 text-muted-foreground" />
											)}
											{model.id === value && (
												<span className="text-xs text-muted-foreground">
													Selected
												</span>
											)}
										</div>
									</CommandItem>
								))}
							</CommandList>
						</Command>
					</div>

					{/* Model details panel */}
					<div className="w-[250px] bg-muted/30">
						<div className="p-4">
							{detailModel ? (
								<div className="space-y-3">
									<div className="flex items-start gap-2">
										{(() => {
											const iconName = PROVIDER_ICONS[
												detailModel.iconProvider
											] as keyof typeof Icons;
											const IconComponent = Icons[iconName];
											return (
												<IconComponent className="w-6 h-6 shrink-0 mt-0.5" />
											);
										})()}
										<div className="flex-1 min-w-0">
											<h4 className="font-medium truncate">
												{detailModel.displayName}
											</h4>
											<p className="text-xs text-muted-foreground capitalize">
												{getProviderDisplayName(detailModel.iconProvider)}
											</p>
										</div>
									</div>

									<div className="h-8 flex items-start">
										<p
											className="text-xs text-muted-foreground leading-tight overflow-hidden"
											style={{
												display: "-webkit-box",
												WebkitLineClamp: 2,
												WebkitBoxOrient: "vertical",
											}}
										>
											{detailModel.description || "No description available"}
										</p>
									</div>

									<div className="space-y-2">
										<p className="text-xs font-medium text-muted-foreground">
											Features
										</p>
										<div className="flex flex-wrap gap-1">
											{Object.entries(detailModel.features).map(
												([feature, enabled]) => {
													if (!enabled) return null;
													const featureKey =
														feature as keyof typeof featureBadges;
													const badge = featureBadges[featureKey];
													if (!(feature in featureBadges)) return null;

													return (
														<Badge
															key={feature}
															variant="secondary"
															className={cn(
																"text-xs px-2 py-0.5",
																badge.className,
															)}
														>
															{badge.label}
														</Badge>
													);
												},
											)}
										</div>
									</div>

									{!detailModel.isAccessible && (
										<div className="pt-2 border-t">
											<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
												<Lock className="w-3 h-3" />
												<span>Sign in required</span>
											</div>
										</div>
									)}
								</div>
							) : (
								<div className="text-center py-8 text-sm text-muted-foreground">
									Hover over a model to see details
								</div>
							)}
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
