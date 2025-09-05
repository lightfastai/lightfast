import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { userId, orgId, sessionClaims } = await auth();

	if (!userId) {
		redirect("/sign-in");
	}

	// Check for pending organization tasks
	if (sessionClaims?.currentTask) {
		console.log(`User ${userId} has pending task: ${String(sessionClaims.currentTask)}`);
		redirect("/select-organization");
	}

	// Check if user has organization membership for authenticated routes
	if (!orgId) {
		console.log(`User ${userId} attempting to access authenticated route without organization`);
		redirect("/select-organization");
	}

	// Fetch organization details to get the slug for redirection
	try {
		const orgResponse = await fetch(`https://api.clerk.com/v1/organizations/${orgId}`, {
			headers: {
				"Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
				"Content-Type": "application/json",
			},
		});

		if (orgResponse.ok) {
			const orgData = await orgResponse.json() as { slug: string | null };
			const orgSlug = orgData.slug || orgId; // Use slug if available, otherwise fall back to ID
			
			console.log(`User ${userId} accessing authenticated route, redirecting to org: ${orgSlug}`);
			redirect(`/${orgSlug}/dashboard`);
		} else {
			console.error("Failed to fetch organization details, redirecting with org ID");
			redirect(`/${orgId}/dashboard`);
		}
	} catch (error) {
		console.error("Error fetching organization details:", error);
		redirect(`/${orgId}/dashboard`);
	}

	// This should not be reached due to redirects above
	return <>{children}</>;
}

