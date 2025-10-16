import Link from "next/link";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { AppHeaderNav } from "./app-header-nav";

export function AppHeader() {

	return (
		<header className="h-14 flex items-center justify-between app-container bg-background">
			<div className="flex items-center">
				<AppHeaderNav />
			</div>

			{/* Right side actions */}
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="sm" asChild>
					<Link href="/sign-in">Log in</Link>
				</Button>
				<Button size="sm" asChild>
					<Link href="/sign-up">Sign up</Link>
				</Button>
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
		</header>
	);
}