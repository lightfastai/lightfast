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
import { teamSettingsFormSchema } from "@repo/console-validation/forms";
import type { TeamSettingsFormValues } from "@repo/console-validation/forms";

interface TeamGeneralSettingsClientProps {
	slug: string;
	organizationId: string;
}

export function TeamGeneralSettingsClient({
	slug,
	organizationId,
}: TeamGeneralSettingsClientProps) {
	const router = useRouter();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { toast } = useToast();
	const [isUpdating, setIsUpdating] = useState(false);

	// Use prefetched data from server (no client-side fetch on mount)
	const { data: organization } = useSuspenseQuery({
		...trpc.organization.findByClerkOrgSlug.queryOptions({
			clerkOrgSlug: slug,
		}),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	// Initialize form with current organization name
	const form = useForm<TeamSettingsFormValues>({
		resolver: zodResolver(teamSettingsFormSchema),
		defaultValues: {
			teamName: organization.slug,
		},
		mode: "onChange",
	});

	// Watch for changes
	const currentFormName = form.watch("teamName");
	const hasChanges = currentFormName !== organization.slug;

	// Update organization name mutation
	const updateNameMutation = useMutation(
		trpc.organization.updateName.mutationOptions({
			onMutate: async (variables) => {
				// Cancel outgoing queries
				await queryClient.cancelQueries({
					queryKey: trpc.organization.findByClerkOrgSlug.queryOptions({
						clerkOrgSlug: slug,
					}).queryKey,
				});

				await queryClient.cancelQueries({
					queryKey: trpc.organization.listUserOrganizations.queryOptions().queryKey,
				});

				// Snapshot previous data
				const previousOrg = queryClient.getQueryData(
					trpc.organization.findByClerkOrgSlug.queryOptions({
						clerkOrgSlug: slug,
					}).queryKey,
				);

				const previousList = queryClient.getQueryData(
					trpc.organization.listUserOrganizations.queryOptions().queryKey,
				);

				// Optimistically update organization details
				if (previousOrg) {
					queryClient.setQueryData(
						trpc.organization.findByClerkOrgSlug.queryOptions({
							clerkOrgSlug: slug,
						}).queryKey,
						produce(previousOrg, (draft) => {
							draft.name = variables.name;
							draft.slug = variables.name;
						}),
					);
				}

				// Optimistically update organization list
				if (previousList) {
					queryClient.setQueryData(
						trpc.organization.listUserOrganizations.queryOptions().queryKey,
						produce(previousList, (draft) => {
							const orgIndex = draft.findIndex((o) => o.id === organizationId);
							if (orgIndex !== -1 && draft[orgIndex]) {
								draft[orgIndex].name = variables.name;
								draft[orgIndex].slug = variables.name;
							}
						}),
					);
				}

				return { previousOrg, previousList };
			},

			onError: (err, _vars, context) => {
				// Rollback on error
				if (context?.previousOrg) {
					queryClient.setQueryData(
						trpc.organization.findByClerkOrgSlug.queryOptions({
							clerkOrgSlug: slug,
						}).queryKey,
						context.previousOrg,
					);
				}

				if (context?.previousList) {
					queryClient.setQueryData(
						trpc.organization.listUserOrganizations.queryOptions().queryKey,
						context.previousList,
					);
				}

				toast({
					title: "Failed to update team name",
					description: err.message || "Please try again.",
					variant: "destructive",
				});
			},

			onSuccess: (data) => {
				toast({
					title: "Team updated!",
					description: `Team name changed to "${data.name}"`,
				});

				// Redirect to new URL with updated team slug
				router.push(`/${data.name}/settings`);
			},

			onSettled: () => {
				// Invalidate to ensure consistency
				void queryClient.invalidateQueries({
					queryKey: trpc.organization.listUserOrganizations.queryOptions().queryKey,
				});

				void queryClient.invalidateQueries({
					queryKey: trpc.organization.findByClerkOrgSlug.queryOptions({
						clerkOrgSlug: slug,
					}).queryKey,
				});

				setIsUpdating(false);
			},
		}),
	);

	const onSubmit = async (values: TeamSettingsFormValues) => {
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
			organizationId,
			name: values.teamName,
		});
	};

	return (
		<div className="space-y-8">
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
					{/* Team Name Section */}
					<div className="space-y-4">
						<div>
							<h2 className="text-xl font-semibold text-foreground">Team Name</h2>
							<p className="text-sm text-muted-foreground mt-1">
								This is your team's visible name within Lightfast.
							</p>
						</div>

						<div className="w-full space-y-4">
							<FormField
								control={form.control}
								name="teamName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input
												{...field}
												onChange={(e) => {
													// Normalize: lowercase, alphanumeric + hyphens only
													const normalized = e.target.value
														.toLowerCase()
														.replace(/[^a-z0-9-]/g, "")
														.replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

													field.onChange(normalized);
												}}
												type="text"
												placeholder="acme-inc"
												className="font-mono"
											/>
										</FormControl>
										<FormDescription>
											Lowercase letters, numbers, and hyphens (3-39 characters)
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
				</form>
			</Form>

			{/* Additional Settings */}
			<div className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-foreground">
						Additional Settings
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						More team configuration options coming soon.
					</p>
				</div>
			</div>
		</div>
	);
}
