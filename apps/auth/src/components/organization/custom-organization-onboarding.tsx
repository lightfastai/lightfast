"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Separator } from "@repo/ui/components/ui/separator";
import { Icons } from "@repo/ui/components/icons";
import { 
	createOrganizationAction, 
	listUserOrganizationsAction, 
	setActiveOrganizationAction,
} from "~/app/select-organization/_actions/organization-actions";
import type {
	OrganizationActionState,
	OrganizationListState,
	OrganizationData,
} from "~/app/select-organization/_actions/organization-actions";
import { captureException } from "@sentry/nextjs";
import { useRouter } from "next/navigation";

// Submit button for create organization form
function CreateOrgSubmitButton() {
	const { pending } = useFormStatus();

	return (
		<Button type="submit" disabled={pending} className="w-full h-12">
			{pending ? (
				<>
					<Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
					Creating...
				</>
			) : (
				"Create Organization"
			)}
		</Button>
	);
}

// Loading state type
type LoadingState = "loading" | "success" | "error";

// Combined state for organization list
type OrganizationListWithState = {
	state: LoadingState;
	data: OrganizationListState;
	error?: string;
};

// Organization list item component
function OrganizationItem({ 
	organization, 
	onSelect,
	isSelecting
}: { 
	organization: OrganizationData;
	onSelect: (organizationId: string) => void;
	isSelecting: boolean;
}) {
	return (
		<div className="flex items-center justify-between p-4 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors">
			<div className="space-y-1 flex-1">
				<h3 className="font-medium">{organization.name}</h3>
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					{organization.slug && (
						<span className="font-mono text-xs bg-muted px-2 py-1 rounded">
							{organization.slug}
						</span>
					)}
					<span>{organization.members_count} member{organization.members_count !== 1 ? 's' : ''}</span>
				</div>
			</div>
			<Button
				onClick={() => onSelect(organization.id)}
				variant="outline"
				className="h-10"
				disabled={isSelecting}
			>
				{isSelecting ? (
					<>
						<Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
						Selecting...
					</>
				) : (
					"Select"
				)}
			</Button>
		</div>
	);
}

/**
 * Custom Organization Onboarding Component
 * 
 * Replaces Clerk's pre-built components with custom UI that uses server actions
 * for organization operations via Clerk's Backend API.
 * Styled to match apps/auth login design pattern.
 */
export function CustomOrganizationOnboarding() {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [mode, setMode] = useState<"loading" | "list" | "create">("loading"); // Start with loading, then decide
	const [organizations, setOrganizations] = useState<OrganizationListWithState>({ 
		state: "loading", 
		data: null 
	});
	const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
	
	// State for create organization form
	const [createState, createAction] = useActionState<OrganizationActionState, FormData>(
		createOrganizationAction,
		{ status: "idle" }
	);
	
	// State for select organization form  
	const [selectState, selectAction] = useActionState<OrganizationActionState, FormData>(
		setActiveOrganizationAction,
		{ status: "idle" }
	);

	// Load organizations on component mount and decide on UI mode
	useEffect(() => {
		async function loadOrganizations() {
			setOrganizations({ state: "loading", data: null });
			try {
				const result = await listUserOrganizationsAction();
				setOrganizations({ state: "success", data: result });
				
				// Decide on UI mode based on existing organizations
				if (result?.hasOrganizations) {
					// If user has exactly one organization, auto-redirect to it
					if (result.organizations.length === 1) {
						const org = result.organizations[0];
						if (org?.id) {
							const formData = new FormData();
							formData.append("organizationId", org.id);
							startTransition(() => {
								selectAction(formData);
							});
							return; // Exit early, redirect will happen via useEffect
						}
					}
					setMode("list"); // Show organization list if they have multiple orgs
				} else {
					setMode("create"); // Show create form immediately for new users
				}
			} catch (error) {
				console.error("Failed to load organizations:", error);
				setOrganizations({ 
					state: "error", 
					data: null, 
					error: "Failed to load organizations" 
				});
				setMode("create"); // Default to create on error
				captureException(error, {
					tags: { component: "CustomOrganizationOnboarding", action: "loadOrganizations" },
				});
			}
		}
		
		void loadOrganizations();
	}, []);

	// Handle successful organization creation
	useEffect(() => {
		if (createState.status === "success" && createState.organizationId) {
			// If we have the slug from creation, redirect directly to cloud app
			if (createState.organizationSlug) {
				window.location.href = `http://localhost:4103/${createState.organizationSlug}/dashboard`;
			} else {
				// Auto-select the newly created organization instead of showing list
				const formData = new FormData();
				formData.append("organizationId", createState.organizationId);
				startTransition(() => {
					selectAction(formData);
				});
			}
		}
	}, [createState, selectAction, startTransition, router]);

	// Handle successful organization selection
	useEffect(() => {
		if (selectState.status === "success" && selectState.organizationId) {
			// Use the organizationSlug from the action if available, otherwise fall back to ID
			const orgSlug = selectState.organizationSlug || selectState.organizationId;
			window.location.href = `http://localhost:4103/${orgSlug}/dashboard`;
		}
	}, [selectState, router]);

	// Track client-side errors for both forms
	useEffect(() => {
		if (createState.status === "error") {
			captureException(new Error(`Organization creation error: ${createState.error}`), {
				tags: {
					component: "custom-organization-onboarding",
					action: "create",
					error_type: createState.isRateLimit ? "rate_limit" : "form_error",
				},
				extra: {
					errorMessage: createState.error,
					isRateLimit: createState.isRateLimit ?? false,
					timestamp: new Date().toISOString(),
				},
				level: createState.isRateLimit ? "warning" : "error",
			});
		}

		if (selectState.status === "error") {
			captureException(new Error(`Organization selection error: ${selectState.error}`), {
				tags: {
					component: "custom-organization-onboarding",
					action: "select",
					error_type: selectState.isRateLimit ? "rate_limit" : "form_error",
				},
				extra: {
					errorMessage: selectState.error,
					isRateLimit: selectState.isRateLimit ?? false,
					timestamp: new Date().toISOString(),
				},
				level: selectState.isRateLimit ? "warning" : "error",
			});
		}
	}, [createState, selectState]);

	// Handle organization selection
	const handleOrganizationSelect = (organizationId: string) => {
		const formData = new FormData();
		formData.append("organizationId", organizationId);
		setSelectedOrgId(organizationId);
		startTransition(() => {
			selectAction(formData);
		});
	};

	// Show loading state while loading organizations
	if (mode === "loading") {
		return (
			<div className="w-full space-y-8">
				<div className="text-center">
					<h1 className="text-3xl font-semibold text-foreground">
						Welcome to Lightfast
					</h1>
				</div>
				<div className="flex items-center justify-center p-8">
					<Icons.spinner className="h-8 w-8 animate-spin" />
					<span className="ml-3 text-muted-foreground">Setting up your account...</span>
				</div>
			</div>
		);
	}

	// Show error state if failed to load organizations
	if (organizations.state === "error") {
		return (
			<div className="w-full space-y-8">
				<div className="text-center">
					<h1 className="text-3xl font-semibold text-foreground">
						Welcome to Lightfast
					</h1>
				</div>
				<div className="space-y-4">
					<div className="rounded-lg bg-red-50 border border-red-200 p-3">
						<p className="text-sm text-red-800">
							{organizations.error}
						</p>
					</div>
					<Button 
						onClick={() => {
							async function retry() {
								const result = await listUserOrganizationsAction();
								setOrganizations({ state: "success", data: result });
							}
							void retry();
						}}
						variant="outline"
						className="w-full h-12"
					>
						Try Again
					</Button>
				</div>
			</div>
		);
	}

	// Show create organization form
	if (mode === "create") {
		return (
			<div className="w-full space-y-8">
				<div className="text-center">
					<h1 className="text-3xl font-semibold text-foreground">
						{organizations.data?.hasOrganizations ? "Create New Organization" : "Create Your Organization"}
					</h1>
					{!organizations.data?.hasOrganizations && (
						<p className="mt-2 text-muted-foreground">
							Get started by creating your organization
						</p>
					)}
				</div>

				<div className="space-y-4">
					{/* Success message */}
					{createState.status === "success" && (
						<div className="rounded-lg bg-green-50 border border-green-200 p-3">
							<p className="text-sm text-green-800">
								{createState.message}
							</p>
						</div>
					)}

					{/* Error message */}
					{(createState.status === "error" || createState.status === "validation_error") && (
						<div className="rounded-lg bg-red-50 border border-red-200 p-3">
							<p className="text-sm text-red-800">
								{createState.error}
							</p>
							{createState.status === "error" && createState.isRateLimit && (
								<p className="text-xs text-red-600 mt-1">
									Please wait a moment before trying again.
								</p>
							)}
						</div>
					)}

					{/* Create organization form */}
					<form action={createAction} className="space-y-4">
						<div>
							<Input
								type="text"
								id="name"
								name="name"
								placeholder="Organization Name (e.g., Acme Corp)"
								required
								maxLength={100}
								className="h-12 bg-background dark:bg-background"
								aria-describedby={
									createState.status === "validation_error" && createState.fieldErrors.name
										? "name-error"
										: undefined
								}
							/>
							{createState.status === "validation_error" && createState.fieldErrors.name && (
								<p id="name-error" className="mt-1 text-sm text-red-600">
									{createState.fieldErrors.name[0]}
								</p>
							)}
						</div>

						<div>
							<Input
								type="text"
								id="slug"
								name="slug"
								placeholder="URL Slug (optional, e.g., acme-corp)"
								className="h-12 bg-background dark:bg-background"
								aria-describedby={
									createState.status === "validation_error" && createState.fieldErrors.slug
										? "slug-error"
										: "slug-help"
								}
							/>
							<p id="slug-help" className="mt-1 text-xs text-muted-foreground">
								Used for URLs. Leave empty to auto-generate.
							</p>
							{createState.status === "validation_error" && createState.fieldErrors.slug && (
								<p id="slug-error" className="mt-1 text-sm text-red-600">
									{createState.fieldErrors.slug[0]}
								</p>
							)}
						</div>

						<CreateOrgSubmitButton />
					</form>

					{organizations.data?.hasOrganizations && (
						<div className="space-y-4">
							<div className="relative">
								<div className="absolute inset-0 flex items-center">
									<Separator className="w-full" />
								</div>
								<div className="relative flex justify-center text-xs uppercase">
									<span className="bg-background px-2 text-muted-foreground">Or</span>
								</div>
							</div>
							<Button
								onClick={() => setMode("list")}
								variant="outline"
								className="w-full h-12"
							>
								← Back to Organization List
							</Button>
						</div>
					)}
				</div>
			</div>
		);
	}

	// Show organization list  
	const hasOrganizations = organizations.data?.hasOrganizations;

	return (
		<div className="w-full space-y-8">
			<div className="text-center">
				<h1 className="text-3xl font-semibold text-foreground">
					{hasOrganizations ? "Select Organization" : "Welcome to Lightfast"}
				</h1>
				{!hasOrganizations && (
					<p className="mt-2 text-muted-foreground">
						Create your first organization to get started
					</p>
				)}
			</div>

			<div className="space-y-4">
				{hasOrganizations && organizations.data && (
					<div className="space-y-3">
						{organizations.data.organizations.map((org) => (
							<OrganizationItem
								key={org.id}
								organization={org}
								onSelect={handleOrganizationSelect}
								isSelecting={selectedOrgId === org.id && (isPending || selectState.status !== "idle")}
							/>
						))}
					</div>
				)}

				{/* Error message for organization selection */}
				{selectState.status === "error" && (
					<div className="rounded-lg bg-red-50 border border-red-200 p-3">
						<p className="text-sm text-red-800">
							{selectState.error}
						</p>
						{selectState.isRateLimit && (
							<p className="text-xs text-red-600 mt-1">
								Please wait a moment before trying again.
							</p>
						)}
					</div>
				)}

				{/* Success message for organization selection */}
				{selectState.status === "success" && (
					<div className="rounded-lg bg-green-50 border border-green-200 p-3">
						<p className="text-sm text-green-800">
							{selectState.message} Redirecting...
						</p>
					</div>
				)}

				<div className="space-y-4">
					{hasOrganizations && (
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<Separator className="w-full" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-background px-2 text-muted-foreground">Or</span>
							</div>
						</div>
					)}
					<Button
						onClick={() => setMode("create")}
						className="w-full h-12"
					>
						Create New Organization
					</Button>
				</div>
			</div>
		</div>
	);
}