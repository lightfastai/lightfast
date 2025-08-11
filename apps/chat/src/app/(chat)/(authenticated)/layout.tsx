import { AuthenticatedHeader } from "~/components/layouts/authenticated-header";
import { TRPCReactProvider } from "~/trpc/react";
import { getQueryClient, trpc } from "~/trpc/server";
import { notFound } from "next/navigation";

interface AuthenticatedLayoutProps {
	children: React.ReactNode;
}

export default async function AuthenticatedLayout({
	children,
}: AuthenticatedLayoutProps) {
	const queryClient = getQueryClient();
	const session = await queryClient.fetchQuery(
		trpc.auth.session.getSession.queryOptions(),
	);

	if (!session?.userId) {
		notFound();
	}

	return (
		<TRPCReactProvider>
			<div className="relative h-full">
				<AuthenticatedHeader />
				{children}
			</div>
		</TRPCReactProvider>
	);
}

