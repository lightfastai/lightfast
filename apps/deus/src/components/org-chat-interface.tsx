"use client";

import type { FormEvent } from "react";
import { useRef, useState, useEffect } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import {
	PromptInput,
	PromptInputBody,
	PromptInputButton,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
} from "@repo/ui/components/ai-elements/prompt-input";
import type {
	PromptInputMessage,
	PromptInputRef,
} from "@repo/ui/components/ai-elements/prompt-input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { GitBranch, Plus, ArrowUp } from "lucide-react";
import { CodeReviewsTab } from "./code-reviews-tab";
import { useTRPC } from "@repo/deus-trpc/react";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/ui/components/ui/tabs";

interface OrgChatInterfaceProps {
	orgId: number;
	organizationId: string;
}

export function OrgChatInterface({ orgId, organizationId }: OrgChatInterfaceProps) {
	const formRef = useRef<PromptInputRef | null>(null);
	const trpc = useTRPC();
	const [selectedRepoId, setSelectedRepoId] = useState<string | undefined>();

	// Query to check if organization has connected repositories
	// Using useSuspenseQuery since data is prefetched in server component
	const { data: repositories = [] } = useSuspenseQuery({
		...trpc.repository.list.queryOptions({
			includeInactive: false,
			organizationId,
		}),
	});

	const hasRepositories = repositories.length > 0;

	// Auto-select first repository when repositories load
	useEffect(() => {
		const firstRepo = repositories[0];
		if (firstRepo && !selectedRepoId) {
			setSelectedRepoId(firstRepo.id);
		}
	}, [repositories, selectedRepoId]);

	const handleSubmit = (
		message: PromptInputMessage,
		event: FormEvent<HTMLFormElement>,
	): void => {
		event.preventDefault();
		console.log("Submit", {
			message,
			orgId,
			selectedRepoId,
			repository: repositories.find((r) => r.id === selectedRepoId),
		});

		// Clear form after successful submission
		formRef.current?.reset();
	};

	return (
		<div className="flex min-h-screen flex-col bg-background text-foreground">
			<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 pb-16 pt-20">
				<div className="mb-12 w-full text-center">
					<h1 className="text-2xl font-normal tracking-tight text-foreground md:text-4xl">
						What should we code next?
					</h1>
				</div>

				<PromptInput
					ref={formRef}
					onSubmit={handleSubmit}
					className={cn(
						"w-full max-w-4xl border-border/50 rounded-2xl overflow-hidden",
						"dark:shadow-md shadow-sm bg-card/50 dark:bg-card/50",
					)}
				>
					<PromptInputBody className="flex flex-col">
						<PromptInputTextarea
							placeholder="Describe a task"
							className={cn(
								"w-full resize-none border-0 rounded-none focus-visible:ring-0",
								"bg-transparent focus:bg-transparent hover:bg-transparent",
								"outline-none min-h-[100px] px-6 py-6 text-base",
								"whitespace-pre-wrap break-words",
							)}
							style={{ lineHeight: "24px" }}
						/>
						<PromptInputToolbar className="flex items-center justify-between gap-2 border-t border-border/50 bg-transparent p-3">
							<PromptInputTools className="flex items-center gap-2">
								<PromptInputButton
									variant="ghost"
									size="sm"
									className="h-8 px-2"
								>
									<Plus className="h-4 w-4" />
								</PromptInputButton>
								{hasRepositories ? (
									<Select value={selectedRepoId} onValueChange={setSelectedRepoId}>
										<SelectTrigger
											className={cn(
												"h-8 w-auto shrink-0 gap-1.5 rounded-full px-3 text-xs",
												"border-border/30 dark:border-border/50",
											)}
										>
											<GitBranch className="h-4 w-4" />
											<SelectValue placeholder="Select repository" />
										</SelectTrigger>
										<SelectContent>
											{repositories.map((repo) => (
												<SelectItem key={repo.id} value={repo.id}>
													{repo.metadata?.fullName ?? "Unknown Repository"}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								) : (
									<PromptInputButton
										variant="outline"
										size="sm"
										className="h-8 gap-1.5 px-3"
										asChild
									>
										<Link href={`/org/${orgId}/settings/repositories`}>
											<GitBranch className="h-4 w-4" />
											<span className="text-xs">Connect GitHub</span>
										</Link>
									</PromptInputButton>
								)}
							</PromptInputTools>
							<div className="flex items-center gap-2">
								<PromptInputSubmit
									size="icon"
									variant="outline"
									className="h-8 w-8 rounded-full dark:border-border/50 dark:shadow-sm"
								>
									<ArrowUp className="h-4 w-4" />
								</PromptInputSubmit>
							</div>
						</PromptInputToolbar>
					</PromptInputBody>
				</PromptInput>

				<Tabs defaultValue="code-reviews" className="w-full max-w-6xl mt-8">
					<TabsList>
						<TabsTrigger value="code-reviews">Code reviews</TabsTrigger>
					</TabsList>
					<TabsContent value="code-reviews" className="mt-6">
						<CodeReviewsTab orgId={organizationId} />
					</TabsContent>
				</Tabs>
			</main>
		</div>
	);
}
