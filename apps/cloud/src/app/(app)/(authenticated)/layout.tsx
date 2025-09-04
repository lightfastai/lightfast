import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@repo/ui/components/ui/sidebar";
import { AppSidebar } from "~/components/app-sidebar";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { userId } = await auth();

	// Temporarily bypass auth for testing API keys functionality
	if (!userId && process.env.NODE_ENV === "development") {
		console.log("!  Bypassing authentication for development testing");
	} else if (!userId) {
		redirect("/sign-in");
	}

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<div className="flex flex-1 flex-col bg-muted/10 border border-border/30 rounded-lg">
					{children}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}

