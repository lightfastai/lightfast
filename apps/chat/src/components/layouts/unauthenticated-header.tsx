import Link from "next/link";
import { Icons } from "@repo/ui/components/icons";
import { Button, buttonVariants } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@repo/ui/components/ui/navigation-menu";
import { getAppUrl } from "@repo/url-utils";
import { UnauthenticatedMobileNav } from "./unauthenticated-mobile-nav";

export function UnauthenticatedHeader() {
	const cloudUrl = getAppUrl("cloud");
	const authUrl = getAppUrl("auth");

	return (
		<>
			{/* Mobile/Tablet header - relative positioning */}
			<header className="lg:hidden relative h-14 flex items-center justify-between px-4 bg-background border-b border-border/50 z-10">
				{/* Left side - Logo */}
				<div className="flex items-center">
					<Button variant="outline" size="xs" asChild>
						<Link href="/">
							<Icons.logoShort className="h-4 w-4" />
						</Link>
					</Button>
				</div>

				{/* Right side - Mobile menu */}
				<div className="flex items-center gap-2">
					<UnauthenticatedMobileNav />
				</div>
			</header>

			{/* Desktop header - absolute positioning */}
			{/* Left side - Logo and navigation */}
			<div className="hidden lg:flex absolute top-0 left-0 h-14 items-center pl-4 z-10 w-fit">
				<Button variant="outline" size="xs" asChild>
					<Link href="/">
						<Icons.logoShort className="h-4 w-4" />
					</Link>
				</Button>
				
				{/* Desktop navigation */}
				<div className="flex items-center ml-4">
				<NavigationMenu>
					<NavigationMenuList>
						<NavigationMenuItem>
							<NavigationMenuTrigger
								className={buttonVariants({ variant: "ghost", size: "lg" })}
							>
								Lightfast Chat
							</NavigationMenuTrigger>
							<NavigationMenuContent>
								<div className="grid gap-2 p-1 md:w-[400px] lg:w-[500px] lg:grid-cols-2">
									<div className="block p-4 bg-accent/50 rounded-md pointer-events-none">
										<div className="text-sm font-medium leading-none mb-2">
											Chat
										</div>
										<p className="text-muted-foreground text-sm leading-snug">
											Experiment with the latest models
										</p>
									</div>
									<Link
										href={cloudUrl}
										className="block p-4 rounded-md hover:bg-accent transition-colors"
									>
										<div className="text-sm font-medium leading-none mb-2">
											Cloud
										</div>
										<p className="text-muted-foreground text-sm leading-snug">
											Enterprise-grade AI infrastructure
										</p>
									</Link>
								</div>
							</NavigationMenuContent>
						</NavigationMenuItem>
					</NavigationMenuList>
				</NavigationMenu>
				</div>
			</div>

			{/* Desktop Right side */}
			<div className="hidden lg:flex absolute top-0 right-0 h-14 items-center pr-4 z-10 w-fit gap-2">
					<Button variant="ghost" size="sm" asChild>
						<Link href={`${authUrl}/sign-in`}>Log in</Link>
					</Button>
					<Button size="sm" asChild>
						<Link href={`${authUrl}/sign-up`}>Sign up</Link>
					</Button>
			</div>
		</>
	);
}