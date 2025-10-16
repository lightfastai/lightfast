import Link from "next/link";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { LoginDropdown } from "./login-dropdown";
import { SearchTrigger } from "./search-trigger";
import { MobileNav } from "./mobile-nav";
import { pageTree } from "../lib/source";
import { getAuthUrls, getAllAppUrls } from "@/src/lib/related-projects";

export function DocsHeader() {
	const authUrls = getAuthUrls();
	const appUrls = getAllAppUrls();

	const chatSignInUrl = `${authUrls.signIn}?redirect_url=${encodeURIComponent(appUrls.chat)}`;
	const cloudSignInUrl = `${authUrls.signIn}?redirect_url=${encodeURIComponent(appUrls.cloud)}`;

	return (
		<header className="h-14 flex items-center justify-between app-container bg-background">
			{/* Left side - Logo */}
			<div className="flex items-center">
				<Button variant="ghost" size="lg" asChild>
					<Link href={appUrls.www}>
						<Icons.logo className="size-22 text-foreground" />
					</Link>
				</Button>
			</div>

			{/* Right side */}
			<div className="flex items-center gap-2">
				{/* Mobile menu button */}
				<MobileNav tree={pageTree} />

				{/* Desktop navigation */}
				<div className="flex items-center max-lg:hidden">
					{/* Navigation Links */}
					<nav className="flex items-center gap-2">
						<Button variant="ghost" size="sm" asChild>
							<Link href="/get-started/overview">Docs</Link>
						</Button>
					</nav>

					<div className="flex h-4 items-center px-4">
						<Separator orientation="vertical" />
					</div>

					<SearchTrigger />

					<div className="flex h-4 items-center px-4">
						<Separator orientation="vertical" />
					</div>
					<LoginDropdown chatUrl={chatSignInUrl} cloudUrl={cloudSignInUrl} />
					<div className="flex h-4 items-center px-4">
						<Separator orientation="vertical" />
					</div>
					<Button variant="ghost" size="xs" asChild>
						<Link
							href="https://github.com/lightfastai/lightfast"
							target="_blank"
							rel="noopener noreferrer"
						>
							<Icons.gitHub className="h-4 w-4" />
							<span className="sr-only">GitHub</span>
						</Link>
					</Button>
				</div>
			</div>
		</header>
	);
}
