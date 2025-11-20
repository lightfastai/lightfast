"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { produce } from "immer";
import { Loader2 } from "lucide-react";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/ui/form";
import { useToast } from "@repo/ui/hooks/use-toast";
import { useTRPC } from "@repo/console-trpc/react";
import {
	workspaceSettingsFormSchema,
	type WorkspaceSettingsFormValues,
} from "../_schemas/workspace-settings-form-schema";

interface WorkspaceGeneralSettingsClientProps {
	slug: string;
	workspaceName: string;
}

export function WorkspaceGeneralSettingsClient({
	slug,
	workspaceName,
}: WorkspaceGeneralSettingsClientProps) {
	const router = useRouter();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { toast } = useToast();
	const [isUpdating, setIsUpdating] = useState(false);

	// Use prefetched data from server (no client-side fetch on mount)
	const { data: workspace } = useSuspenseQuery({
		...trpc.workspace.getByName.queryOptions({
			clerkOrgSlug: slug,
			workspaceName,
		}),
		refetchOnMount: false, // Use prefetched server data
		refetchOnWindowFocus: false, // Don't refetch on window focus
	});

	// Initialize form with current workspace name
	const form = useForm<WorkspaceSettingsFormValues>({
		resolver: zodResolver(workspaceSettingsFormSchema),
		defaultValues: {
			workspaceName: workspace.name,
		},
		mode: "onChange",
	});

	// Watch for changes
	const currentFormName = form.watch("workspaceName");
	const hasChanges = currentFormName !== workspace.name;

	// Update workspace name mutation
	const updateNameMutation = useMutation(
		trpc.workspace.updateName.mutationOptions({
			onMutate: async (variables) => {
				// Cancel outgoing queries
				await queryClient.cancelQueries({
					queryKey: trpc.workspace.getByName.queryOptions({
						clerkOrgSlug: slug,
						workspaceName,
					}).queryKey,
				});

				await queryClient.cancelQueries({
					queryKey: trpc.workspace.listByClerkOrgSlug.queryOptions({
						clerkOrgSlug: slug,
					}).queryKey,
				});

				// Snapshot previous data
				const previousWorkspace = queryClient.getQueryData(
					trpc.workspace.getByName.queryOptions({
						clerkOrgSlug: slug,
						workspaceName,
					}).queryKey,
				);

				const previousList = queryClient.getQueryData(
					trpc.workspace.listByClerkOrgSlug.queryOptions({
						clerkOrgSlug: slug,
					}).queryKey,
				);

				// Optimistically update workspace details
				if (previousWorkspace) {
					queryClient.setQueryData(
						trpc.workspace.getByName.queryOptions({
							clerkOrgSlug: slug,
							workspaceName,
						}).queryKey,
						produce(previousWorkspace, (draft) => {
							draft.name = variables.newWorkspaceName;
						}),
					);
				}

				// Optimistically update workspace list
				if (previousList) {
					queryClient.setQueryData(
						trpc.workspace.listByClerkOrgSlug.queryOptions({
							clerkOrgSlug: slug,
						}).queryKey,
						produce(previousList, (draft) => {
							const workspaceIndex = draft.findIndex((w) => w.id === workspace.id);
							if (workspaceIndex !== -1) {
								draft[workspaceIndex]!.name = variables.newWorkspaceName;
							}
						}),
					);
				}

				return { previousWorkspace, previousList };
			},

			onError: (err, _vars, context) => {
				// Rollback on error
				if (context?.previousWorkspace) {
					queryClient.setQueryData(
						trpc.workspace.getByName.queryOptions({
							clerkOrgSlug: slug,
							workspaceName,
						}).queryKey,
						context.previousWorkspace,
					);
				}

				if (context?.previousList) {
					queryClient.setQueryData(
						trpc.workspace.listByClerkOrgSlug.queryOptions({
							clerkOrgSlug: slug,
						}).queryKey,
						context.previousList,
					);
				}

				toast({
					title: "Failed to update workspace name",
					description: err.message || "Please try again.",
					variant: "destructive",
				});
			},

			onSuccess: (data) => {
				toast({
					title: "Workspace updated!",
					description: `Workspace name changed to "${data.newWorkspaceName}"`,
				});

				// Redirect to new URL with updated workspace name
				router.push(`/${slug}/${data.newWorkspaceName}/settings`);
			},

			onSettled: () => {
				// Invalidate to ensure consistency
				void queryClient.invalidateQueries({
					queryKey: trpc.workspace.listByClerkOrgSlug.queryOptions({
						clerkOrgSlug: slug,
					}).queryKey,
				});

				setIsUpdating(false);
			},
		}),
	);

	const onSubmit = async (values: WorkspaceSettingsFormValues) => {
		// Trigger validation
		const isValid = await form.trigger();
		if (!isValid) {
			toast({
				title: "Validation failed",
				description: "Please fix the errors in the form before submitting.",
				variant: "destructive",
			});
			return;
		}

		setIsUpdating(true);

		updateNameMutation.mutate({
			clerkOrgSlug: slug,
			workspaceName: workspace.name,
			newWorkspaceName: values.workspaceName,
		});
	};

	return (
		<div className="space-y-8">
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
					{/* Workspace Name Section */}
					<div className="space-y-4">
						<div>
							<h2 className="text-xl font-semibold text-foreground">
								Workspace Name
							</h2>
							<p className="text-sm text-muted-foreground mt-1">
								This is your workspace's visible name within the organization.
							</p>
						</div>

						<div className="w-full space-y-4">
							<FormField
								control={form.control}
								name="workspaceName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input
												{...field}
												type="text"
												placeholder="my-workspace"
												className="font-mono"
											/>
										</FormControl>
										<FormDescription>
											Letters, numbers, hyphens, periods, and underscores (max 100
											characters)
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="flex justify-end">
								<Button
									type="submit"
									disabled={!hasChanges || !form.formState.isValid || isUpdating}
									variant="secondary"
								>
									{isUpdating ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Saving...
										</>
									) : (
										"Save"
									)}
								</Button>
							</div>
						</div>
					</div>

					{/* Workspace Slug Section (Read-Only) */}
					<div className="space-y-4">
						<div>
							<h2 className="text-xl font-semibold text-foreground">
								Workspace Slug (Internal)
							</h2>
							<p className="text-sm text-muted-foreground mt-1">
								Auto-generated identifier used for Pinecone index naming. This cannot
								be changed.
							</p>
						</div>

						<div className="w-full">
							<Input
								type="text"
								value={workspace.slug}
								disabled
								className="bg-muted/50 font-mono text-sm"
							/>
						</div>
					</div>
				</form>
			</Form>

			{/* Additional Settings */}
			<div className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-foreground">
						Additional Settings
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						More workspace configuration options coming soon.
					</p>
				</div>
			</div>
		</div>
	);
}
