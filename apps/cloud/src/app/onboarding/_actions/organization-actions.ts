"use server";

import { z } from "zod";
import { arcjet, shield, detectBot, fixedWindow, request, ARCJET_KEY } from "@vendor/security";
import { redis } from "@vendor/upstash";
import { captureException } from "@sentry/nextjs";
import { auth } from "@clerk/nextjs/server";

export type OrganizationActionState =
	| { status: "idle" }
	| { status: "success"; message: string; organizationId?: string; organizationSlug?: string }
	| { status: "error"; error: string; isRateLimit?: boolean }
	| {
			status: "validation_error";
			fieldErrors: { name?: string[]; slug?: string[] };
			error: string;
	  };

export type OrganizationData = {
	id: string;
	name: string;
	slug: string | null;
	role: string;
	members_count: number;
};

export type OrganizationListState = {
	organizations: OrganizationData[];
	hasOrganizations: boolean;
} | null;

const createOrganizationSchema = z.object({
	name: z
		.string()
		.min(1, "Organization name is required")
		.max(100, "Organization name must be less than 100 characters")
		.trim(),
	slug: z
		.string()
		.max(50, "Slug must be less than 50 characters")
		.regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
		.optional()
		.or(z.literal("")),
});

const ORGANIZATION_ACTIONS_KEY = "org:actions:";

// Configure Arcjet protection for organization actions
const aj = arcjet({
	key: ARCJET_KEY,
	// Use IP + user ID for rate limiting characteristics
	// Allow fallback if IP is not available in server actions
	characteristics: ["ip.src"],
	rules: [
		// Shield protects against common attacks
		shield({
			mode: process.env.NODE_ENV === "production" ? "LIVE" : "DRY_RUN",
		}),
		// Block automated bots
		detectBot({
			mode: "LIVE",
			allow: [
				"CATEGORY:SEARCH_ENGINE", // Allow search engines
				"CATEGORY:MONITOR", // Allow monitoring services
			],
		}),
		// Hourly limit for organization operations
		fixedWindow({
			mode: "LIVE",
			window: "1h",
			max: 10, // Allow up to 10 org operations per hour
		}),
		// Daily limit to prevent abuse
		fixedWindow({
			mode: "LIVE",
			window: "24h",
			max: 20, // Maximum 20 org operations per day
		}),
		// Burst protection
		fixedWindow({
			mode: "LIVE", 
			window: "10s",
			max: 3, // Max 3 attempts in 10 seconds
		}),
	],
});

/**
 * Create a new organization using Clerk's Backend API
 */
export async function createOrganizationAction(
	prevState: OrganizationActionState | null,
	formData: FormData,
): Promise<OrganizationActionState> {
	try {
		// Get authenticated user (allow pending sessions for organization onboarding)
		const { userId } = await auth({ treatPendingAsSignedOut: false });
		if (!userId) {
			return {
				status: "error",
				error: "You must be signed in to create an organization.",
			};
		}

		// Parse and validate form data
		const validatedFields = createOrganizationSchema.safeParse({
			name: formData.get("name"),
			slug: formData.get("slug") || "",
		});

		// Return field errors if validation fails
		if (!validatedFields.success) {
			return {
				status: "validation_error",
				fieldErrors: validatedFields.error.flatten().fieldErrors,
				error: "Please fix the errors below",
			};
		}

		const { name, slug } = validatedFields.data;

		// Check Arcjet protection
		try {
			const req = await request();
			const decision = await aj.protect(req);
			
			// Handle denied requests from Arcjet
			if (decision.isDenied()) {
				const reason = decision.reason;
				
				if (reason.isRateLimit()) {
					return {
						status: "error",
						error: "Too many organization operations. Please try again later.",
						isRateLimit: true,
					};
				}
				
				if (reason.isBot()) {
					return {
						status: "error",
						error: "Automated request detected. Please complete the form manually.",
					};
				}
				
				if (reason.isShield()) {
					return {
						status: "error",
						error: "Request blocked for security reasons. Please try again.",
					};
				}
				
				// Generic denial message
				return {
					status: "error",
					error: "Your request could not be processed. Please try again.",
				};
			}
		} catch (arcjetError) {
			// Log Arcjet errors but don't block the user
			console.error("Arcjet error in organization action:", arcjetError);
			captureException(arcjetError, {
				tags: {
					action: "createOrganization:arcjet",
					userId,
				},
			});
			// Continue with request - don't block user if Arcjet fails
		}


		// Track rate limiting in Redis (non-critical)
		try {
			const rateLimitKey = `${ORGANIZATION_ACTIONS_KEY}${userId}`;
			await redis.incr(rateLimitKey);
			await redis.expire(rateLimitKey, 3600); // 1 hour expiry
		} catch (redisError) {
			console.error("Redis rate limit tracking error:", redisError);
			// Continue - don't block user if Redis is down
		}

		try {
			// Create organization using Clerk's Backend API
			const response = await fetch("https://api.clerk.com/v1/organizations", {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: name,
					slug: slug && slug.length > 0 ? slug : undefined,
					created_by: userId,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json() as any;
				console.error("Clerk organization creation error:", errorData);
				
				// Handle specific Clerk errors
				if (response.status === 422 && errorData.errors) {
					const clerkError = errorData.errors[0];
					if (clerkError?.code === "duplicate_record") {
						return {
							status: "error",
							error: "An organization with this name already exists. Please choose a different name.",
						};
					}
					if (clerkError?.code === "form_param_format_invalid") {
						return {
							status: "error",
							error: "Organization name format is invalid. Please use only letters, numbers, and spaces.",
						};
					}
				}
				
				if (response.status === 429) {
					return {
						status: "error",
						error: "Too many requests. Please wait a moment before trying again.",
						isRateLimit: true,
					};
				}
				
				throw new Error(`Clerk API error: ${response.status} ${response.statusText}`);
			}

			const organizationData = await response.json() as any;
			
			// Set the newly created organization as active
			// First, we need to get the membership ID for the newly created organization
			const membershipsResponse = await fetch(`https://api.clerk.com/v1/users/${userId}/organization_memberships`, {
				method: "GET",
				headers: {
					"Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
					"Content-Type": "application/json",
				},
			});

			if (membershipsResponse.ok) {
				const membershipsData = await membershipsResponse.json() as any;
				const membership = membershipsData.data?.find((m: any) => m.organization.id === organizationData.id);
				
				if (membership) {
					const setActiveResponse = await fetch(`https://api.clerk.com/v1/users/${userId}/organization_memberships/${membership.id}/set_active`, {
						method: "POST",
						headers: {
							"Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
							"Content-Type": "application/json",
						},
					});

					if (!setActiveResponse.ok) {
						console.error("Failed to set active organization, but organization was created");
						// Don't fail the user experience if this fails
					}
				} else {
					console.error("Could not find membership for newly created organization");
				}
			} else {
				console.error("Failed to fetch memberships to set active organization");
			}

			// Clear any pending session tasks since organization creation/selection is complete
			try {
				const clearTaskResponse = await fetch(`https://api.clerk.com/v1/users/${userId}/session_tasks`, {
					method: "DELETE",
					headers: {
						"Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
						"Content-Type": "application/json",
					},
				});

				if (!clearTaskResponse.ok) {
					console.error("Failed to clear session tasks, but organization was created successfully");
					// Don't fail the user experience if this fails
				} else {
					console.log("Successfully cleared session tasks after organization creation");
				}
			} catch (clearTaskError) {
				console.error("Error clearing session tasks:", clearTaskError);
				// Don't fail the user experience if this fails
			}

			// Get organization slug for proper redirect
			const orgSlug = organizationData.slug || organizationData.id;

			return {
				status: "success",
				message: `Successfully created "${name}"! Redirecting to dashboard...`,
				organizationId: organizationData.id,
				organizationSlug: orgSlug,
			};
		} catch (clerkError) {
			console.error("Unexpected Clerk error:", clerkError);
			captureException(clerkError, {
				tags: {
					action: "createOrganization:api-call",
					userId,
					organizationName: name,
				},
			});

			return {
				status: "error",
				error: "Failed to create organization. Please try again later.",
			};
		}
	} catch (error) {
		console.error("Error in create organization action:", error);
		captureException(error, {
			tags: {
				action: "createOrganization:outer",
			},
			extra: {
				formData: Object.fromEntries(formData.entries()),
			},
		});

		return {
			status: "error",
			error: error instanceof Error ? error.message : "An error occurred. Please try again.",
		};
	}
}

/**
 * List user's organizations using Clerk's Backend API
 */
export async function listUserOrganizationsAction(): Promise<OrganizationListState> {
	try {
		// Get authenticated user (allow pending sessions for organization onboarding)
		const { userId } = await auth({ treatPendingAsSignedOut: false });
		if (!userId) {
			return null;
		}

		const response = await fetch(`https://api.clerk.com/v1/users/${userId}/organization_memberships`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			console.error("Failed to fetch user organizations:", response.status, response.statusText);
			captureException(new Error("Failed to fetch organizations"), {
				tags: {
					action: "listUserOrganizations:api-call",
					userId,
					httpStatus: response.status,
				},
			});
			return null;
		}

		const data = await response.json() as any;
		const organizations: OrganizationData[] = data.data?.map((membership: any) => ({
			id: membership.organization.id,
			name: membership.organization.name,
			slug: membership.organization.slug,
			role: membership.role,
			members_count: membership.organization.members_count || 1,
		})) || [];

		return {
			organizations,
			hasOrganizations: organizations.length > 0,
		};
	} catch (error) {
		console.error("Error listing user organizations:", error);
		captureException(error, {
			tags: {
				action: "listUserOrganizations:outer",
			},
		});
		return null;
	}
}

/**
 * Set active organization for the user
 */
export async function setActiveOrganizationAction(
	prevState: OrganizationActionState | null,
	formData: FormData,
): Promise<OrganizationActionState> {
	const organizationId = formData.get("organizationId") as string;
	
	if (!organizationId) {
		return {
			status: "error",
			error: "Organization ID is required.",
		};
	}
	try {
		// Get authenticated user (allow pending sessions for organization onboarding)
		const { userId } = await auth({ treatPendingAsSignedOut: false });
		if (!userId) {
			return {
				status: "error",
				error: "You must be signed in to create an organization.",
			};
		}

		// Find the membership ID for this organization
		const membershipsResponse = await fetch(`https://api.clerk.com/v1/users/${userId}/organization_memberships`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
				"Content-Type": "application/json",
			},
		});

		if (!membershipsResponse.ok) {
			throw new Error("Failed to fetch user memberships");
		}

		const membershipsData = await membershipsResponse.json() as any;
		const membership = membershipsData.data?.find((m: any) => m.organization.id === organizationId);

		if (!membership) {
			return {
				status: "error",
				error: "You are not a member of this organization.",
			};
		}

		// Set the organization as active
		const response = await fetch(`https://api.clerk.com/v1/users/${userId}/organization_memberships/${membership.id}/set_active`, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			console.error("Failed to set active organization:", response.status, response.statusText);
			throw new Error("Failed to set active organization");
		}

		// Clear any pending session tasks since organization selection is complete
		try {
			const clearTaskResponse = await fetch(`https://api.clerk.com/v1/users/${userId}/session_tasks`, {
				method: "DELETE",
				headers: {
					"Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
					"Content-Type": "application/json",
				},
			});

			if (!clearTaskResponse.ok) {
				console.error("Failed to clear session tasks, but organization was set successfully");
				// Don't fail the user experience if this fails
			} else {
				console.log("Successfully cleared session tasks after organization selection");
			}
		} catch (clearTaskError) {
			console.error("Error clearing session tasks:", clearTaskError);
			// Don't fail the user experience if this fails
		}

		// Return organization details including slug for proper redirect
		const orgSlug = membership.organization.slug || organizationId;
		
		return {
			status: "success",
			message: `Switched to "${membership.organization.name}". Redirecting to dashboard...`,
			organizationId,
			organizationSlug: orgSlug,
		};
	} catch (error) {
		console.error("Error setting active organization:", error);
		captureException(error, {
			tags: {
				action: "setActiveOrganization",
			},
			extra: {
				organizationId,
			},
		});

		return {
			status: "error",
			error: "Failed to switch organization. Please try again.",
		};
	}
}