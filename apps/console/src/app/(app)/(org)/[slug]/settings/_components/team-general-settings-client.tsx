"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganizationList } from "@clerk/nextjs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
}

export function TeamGeneralSettingsClient({
	slug,
}: TeamGeneralSettingsClientProps) {
	const router = useRouter();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { setActive } = useOrganizationList();
	const { toast } = useToast();
	const [isUpdating, setIsUpdating] = useState(false);

	// Use cached organization list from app layout (avoids Clerk 404 timing issues)
	const { data: organizations } = useSuspenseQuery({
		...trpc.organization.listUserOrganizations.queryOptions(),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	// Find current organization from cached list by slug
	const organization = organizations.find((org) => org.slug === slug);

	if (!organization) {
		throw new Error(`Organization not found: ${slug}`);
	}

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
			onError: (err) => {
				toast({
					title: "Failed to update team name",
					description: err.message || "Please try again.",
					variant: "destructive",
				});
			},

			onSuccess: async (data) => {
				toast({
					title: "Team updated!",
					description: `Team name changed to "${data.name}"`,
				});

				// Update Clerk's active organization before navigation
				// This ensures cookies are updated before the RSC request
				try {
					await setActive({ organization: data.id });

					// Refresh router cache to clear any stale RSC data
					router.refresh();

					// Navigate with updated cookies (client-side navigation)
					router.push(`/${data.name}/settings`);
				} catch (error) {
					console.error("Failed to set active organization:", error);
					// Still navigate, but may cause temporary mismatch
					router.push(`/${data.name}/settings`);
				}
			},

			onSettled: () => {
				// Invalidate to ensure consistency with server
				void queryClient.invalidateQueries({
					queryKey: trpc.organization.listUserOrganizations.queryOptions().queryKey,
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
			slug,
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
