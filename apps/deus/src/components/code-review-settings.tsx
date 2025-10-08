"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Code2, Github, Save, Info } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Switch } from "@repo/ui/components/ui/switch";
import { useTRPC } from "@repo/deus-trpc/react";
import { toast } from "sonner";

interface CodeReviewSettingsProps {
	organizationId: string;
}

type CodeReviewTool = "coderabbit" | "claude" | "vercel-agents" | "custom";

const CODE_REVIEW_TOOLS: Record<
	CodeReviewTool,
	{ name: string; command: string; description: string }
> = {
	coderabbit: {
		name: "CodeRabbit",
		command: "@coderabbit review",
		description: "AI-powered code review assistant with inline suggestions",
	},
	claude: {
		name: "Claude Code Reviewer",
		command: "@claude-code-reviewer review",
		description: "GitHub Action for code reviews powered by Claude",
	},
	"vercel-agents": {
		name: "Vercel Agents",
		command: "@vercel-agent review",
		description: "Vercel's AI code review agent",
	},
	custom: {
		name: "Custom Tool",
		command: "@custom-tool review",
		description: "Configure your own code review tool",
	},
};

export function CodeReviewSettings({
	organizationId,
}: CodeReviewSettingsProps) {
	const trpc = useTRPC();
	const [editingRepoId, setEditingRepoId] = useState<string | null>(null);
	const [localSettings, setLocalSettings] = useState<
		Record<string, { enabled: boolean; tool: CodeReviewTool; command: string }>
	>({});

	// Query to fetch organization's connected repositories
	const { data: repositories = [], isLoading } = useQuery({
		...trpc.repository.list.queryOptions({
			includeInactive: false,
			organizationId,
		}),
	});

	const hasRepositories = repositories.length > 0;

	// Initialize local settings when editing starts
	const startEditing = (repoId: string) => {
		const repo = repositories.find((r) => r.id === repoId);
		if (repo) {
			const settings = repo.codeReviewSettings ?? {
				enabled: false,
				tool: "coderabbit" as CodeReviewTool,
			};
			setLocalSettings({
				...localSettings,
				[repoId]: {
					enabled: settings.enabled ?? false,
					tool: settings.tool ?? "coderabbit",
					command:
						settings.command ??
						CODE_REVIEW_TOOLS[settings.tool ?? "coderabbit"].command,
				},
			});
			setEditingRepoId(repoId);
		}
	};

	const cancelEditing = () => {
		setEditingRepoId(null);
		setLocalSettings({});
	};

	const updateLocalSetting = (
		repoId: string,
		key: "enabled" | "tool" | "command",
		value: boolean | string,
	) => {
		const current = localSettings[repoId] ?? {
			enabled: false,
			tool: "coderabbit",
			command: CODE_REVIEW_TOOLS.coderabbit.command,
		};

		if (key === "tool") {
			// When tool changes, update command to default
			const toolValue = value as CodeReviewTool;
			setLocalSettings({
				...localSettings,
				[repoId]: {
					...current,
					tool: toolValue,
					command: CODE_REVIEW_TOOLS[toolValue].command,
				},
			});
		} else {
			setLocalSettings({
				...localSettings,
				[repoId]: { ...current, [key]: value },
			});
		}
	};

	const saveSettings = (repoId: string) => {
		const settings = localSettings[repoId];
		if (!settings) return;

		// TODO: Implement mutation to save settings
		toast.success("Code review settings saved");
		setEditingRepoId(null);
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Code2 className="h-5 w-5" />
						<div>
							<CardTitle>Code Review Configuration</CardTitle>
							<CardDescription className="mt-1">
								Configure code review tools for your repositories
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
						<div className="flex gap-2">
							<Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
							<div className="text-xs text-foreground/80">
								<p className="font-medium">How it works:</p>
								<p className="mt-1">
									When you trigger a code review, Deus will post a comment on your
									PR with the configured command. The review tool will run on
									GitHub and post its findings as comments.
								</p>
							</div>
						</div>
					</div>

					{isLoading ? (
						<div className="py-8 text-center">
							<p className="text-sm text-muted-foreground">
								Loading repositories...
							</p>
						</div>
					) : hasRepositories ? (
						<div className="space-y-4">
							{repositories.map((repo) => {
								const isEditing = editingRepoId === repo.id;
								const settings =
									localSettings[repo.id] ??
									repo.codeReviewSettings ?? {
										enabled: false,
										tool: "coderabbit",
									};

								return (
									<div
										key={repo.id}
										className="rounded-lg border border-border/60 bg-card p-4"
									>
										<div className="flex items-start justify-between">
											<div className="flex items-start gap-3 min-w-0 flex-1">
												<Github className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
												<div className="min-w-0 flex-1">
													<p className="text-sm font-medium truncate">
														{repo.metadata?.fullName ?? "Unknown Repository"}
													</p>
													{repo.metadata?.description && (
														<p className="text-xs text-muted-foreground mt-1 line-clamp-1">
															{repo.metadata.description}
														</p>
													)}
												</div>
											</div>
											{!isEditing && (
												<Button
													variant="outline"
													size="sm"
													onClick={() => startEditing(repo.id)}
												>
													Configure
												</Button>
											)}
										</div>

										{isEditing && (
											<div className="mt-4 space-y-4 border-t border-border/40 pt-4">
												<div className="flex items-center justify-between">
													<Label htmlFor={`enabled-${repo.id}`} className="text-sm">
														Enable code review
													</Label>
													<Switch
														id={`enabled-${repo.id}`}
														checked={settings.enabled}
														onCheckedChange={(checked) =>
															updateLocalSetting(repo.id, "enabled", checked)
														}
													/>
												</div>

												{settings.enabled && (
													<>
														<div className="space-y-2">
															<Label
																htmlFor={`tool-${repo.id}`}
																className="text-sm"
															>
																Review tool
															</Label>
															<Select
																value={settings.tool}
																onValueChange={(value: CodeReviewTool) =>
																	updateLocalSetting(repo.id, "tool", value)
																}
															>
																<SelectTrigger id={`tool-${repo.id}`}>
																	<SelectValue />
																</SelectTrigger>
																<SelectContent>
																	{Object.entries(CODE_REVIEW_TOOLS).map(
																		([key, tool]) => (
																			<SelectItem key={key} value={key}>
																				<div>
																					<div className="font-medium">
																						{tool.name}
																					</div>
																					<div className="text-xs text-muted-foreground">
																						{tool.description}
																					</div>
																				</div>
																			</SelectItem>
																		),
																	)}
																</SelectContent>
															</Select>
														</div>

														<div className="space-y-2">
															<Label
																htmlFor={`command-${repo.id}`}
																className="text-sm"
															>
																Trigger command
															</Label>
															<Input
																id={`command-${repo.id}`}
																value={settings.command}
																onChange={(e) =>
																	updateLocalSetting(
																		repo.id,
																		"command",
																		e.target.value,
																	)
																}
																placeholder="@coderabbit review"
																className="font-mono text-xs"
															/>
															<p className="text-xs text-muted-foreground">
																This command will be posted as a comment on your PR
															</p>
														</div>

														<div className="flex gap-2 pt-2">
															<Button
																size="sm"
																onClick={() => saveSettings(repo.id)}
																className="gap-2"
															>
																<Save className="h-3.5 w-3.5" />
																Save
															</Button>
															<Button
																size="sm"
																variant="outline"
																onClick={cancelEditing}
															>
																Cancel
															</Button>
														</div>
													</>
												)}
											</div>
										)}

										{!isEditing && settings.enabled && (
											<div className="mt-3 rounded-md bg-muted/30 px-3 py-2">
												<div className="flex items-center gap-2 text-xs">
													<span className="text-muted-foreground">Tool:</span>
													<span className="font-medium">
														{
															CODE_REVIEW_TOOLS[
																settings.tool ?? "coderabbit"
															].name
														}
													</span>
													<span className="text-muted-foreground">·</span>
													<code className="rounded bg-background px-1.5 py-0.5 font-mono">
														{settings.command ??
															CODE_REVIEW_TOOLS[
																settings.tool ?? "coderabbit"
															].command}
													</code>
												</div>
											</div>
										)}
									</div>
								);
							})}
						</div>
					) : (
						<div className="py-12">
							<div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-8">
								<div className="flex flex-col items-center text-center">
									<Github className="h-12 w-12 text-muted-foreground/60" />
									<p className="mt-3 text-sm font-medium">
										No repositories connected
									</p>
									<p className="mt-1 text-xs text-muted-foreground max-w-sm">
										Connect a GitHub repository first to configure code review
										settings
									</p>
									<Button className="mt-4" asChild>
										<a href="../repositories">Go to Repositories</a>
									</Button>
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
