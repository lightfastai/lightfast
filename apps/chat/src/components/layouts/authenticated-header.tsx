import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { Icons } from "@repo/ui/components/icons";
import { UserDropdownMenu } from "./user-dropdown-menu";
import { AuthenticatedMobileNav } from "./authenticated-mobile-nav";
import { SidebarTrigger } from "@repo/ui/components/ui/sidebar";

export function AuthenticatedHeader() {

	return (
		<>
			{/* Mobile/Tablet header - relative positioning */}
			<header className="lg:hidden relative h-14 flex items-center justify-between px-4 bg-background border-b border-border/50 z-10">
				{/* Left side - Logo and New Chat */}
				<div className="flex items-center">
					<Button variant="outline" size="xs" asChild>
						<Link href="/">
							<Icons.logoShort className="h-4 w-4" />
						</Link>
					</Button>
					
					{/* New Chat Button */}
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

				{/* Right side - Mobile menu */}
				<div className="flex items-center gap-2">
					<AuthenticatedMobileNav />
				</div>
			</header>

			{/* Desktop header - absolute positioning */}
			{/* Left side - Sidebar trigger and New Chat */}
			<div className="hidden lg:flex absolute top-0 left-0 h-14 items-center pl-4 z-10 w-fit gap-2">
				<SidebarTrigger />
				<Separator orientation="vertical" className="h-4" />
				<Button size="xs" variant="ghost" asChild>
					<Link href="/new">
						<Icons.newChat className="h-4 w-4" />
						<span className="sr-only">New Chat</span>
					</Link>
				</Button>
			</div>

			{/* Desktop Right side */}
			<div className="hidden lg:flex absolute top-0 right-0 h-14 items-center pr-4 z-10 w-fit gap-2">
				{/* User dropdown */}
				<div>
					<UserDropdownMenu />
				</div>
			</div>
		</>
	);
}

