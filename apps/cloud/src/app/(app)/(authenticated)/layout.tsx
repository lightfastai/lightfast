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

	// Layout doesn't redirect - just provides authenticated context
	console.log(`User ${userId} accessing authenticated route with org ${orgId}`);
	return <>{children}</>;
}

