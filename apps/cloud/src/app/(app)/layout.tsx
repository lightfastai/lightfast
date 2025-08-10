import Link from "next/link";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { getAppUrl } from "@repo/url-utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const chatUrl = getAppUrl("chat");
	const wwwUrl = getAppUrl("www");

	return (
		<div className="min-h-screen bg-background relative">
			<header className="absolute top-0 left-0 right-0 z-10">
				<div className="max-w-5xl mx-auto px-4 py-12 flex items-center justify-between">
					<Link href={wwwUrl} className="flex items-center">
						<Icons.logo className="h-5 w-auto" />
					</Link>

					<Button variant="secondary" size="lg" asChild>
						<Link href={chatUrl} target="_blank" rel="noopener noreferrer">
							Go to Lightfast Chat
						</Link>
					</Button>
				</div>
			</header>
			<main className="h-screen">{children}</main>
		</div>
	);
}
