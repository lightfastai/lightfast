import Link from "next/link";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { getAuthUrls, getAllAppUrls } from "@repo/url-utils";
import { ThemeToggle } from "./theme-toggle";
import { SearchTrigger } from "./search-trigger";
import { SidebarTrigger } from "./sidebar-trigger";

export function DocsHeader() {
	const authUrls = getAuthUrls();
	const appUrls = getAllAppUrls();

	return (
		<header className="h-14 flex items-center justify-between px-4 lg:px-6 bg-background">
			<div className="flex items-center gap-4">
				<div className="flex items-center pr-4 border-r">
					<Button variant="outline" size="xs" asChild>
						<Link href={appUrls.www}>
							<Icons.logoShort className="h-4 w-4" />
						</Link>
					</Button>
				</div>
				<SidebarTrigger />
			</div>

			{/* Right side actions */}
			<div className="flex items-center">
				<SearchTrigger />
				<div className="flex h-4 items-center mx-2">
					<Separator orientation="vertical" />
				</div>
				<Button variant="outline" size="sm" asChild>
					<Link href={authUrls.signIn}>Login</Link>
				</Button>
				<Button size="sm" className="ml-2" asChild>
					<Link href={authUrls.signUp}>Sign up</Link>
				</Button>
				<div className="flex h-4 items-center mx-2">
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
				<div className="flex h-4 items-center mx-2">
					<Separator orientation="vertical" />
				</div>
				<ThemeToggle />
			</div>
		</header>
	);
}

