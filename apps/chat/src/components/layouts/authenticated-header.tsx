import Link from "next/link";
import { Button, buttonVariants } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { Icons } from "@repo/ui/components/icons";
import { getAppUrl } from "@repo/url-utils";
import { UserDropdownMenu } from "./user-dropdown-menu";
import { AuthenticatedMobileNav } from "./authenticated-mobile-nav";

export function AuthenticatedHeader() {
	const cloudUrl = getAppUrl("cloud");

	return (
		<>
			{/* Left side - Logo and New Chat */}
			<div className="absolute top-0 left-0 h-14 flex items-center pl-4 z-10 w-fit">
				<Button variant="outline" size="xs" asChild>
					<Link href="/">
						<Icons.logoShort className="h-4 w-4" />
					</Link>
				</Button>
				
				{/* New Chat Button - visible on all screen sizes */}
				<div className="flex items-center">
					<div className="flex h-4 items-center px-4">
						<Separator orientation="vertical" />
					</div>
					<Button size="xs" variant="ghost" asChild>
						<Link href="/new">
							<Icons.newChat className="h-4 w-4" />
						</Link>
					</Button>
				</div>
			</div>

			{/* Right side */}
			<div className="absolute top-0 right-0 h-14 flex items-center pr-4 z-10 w-fit gap-2">
				{/* Mobile menu button */}
				<AuthenticatedMobileNav />
				
				{/* Desktop - User dropdown */}
				<div className="hidden lg:block">
					<UserDropdownMenu />
				</div>
			</div>
		</>
	);
}

