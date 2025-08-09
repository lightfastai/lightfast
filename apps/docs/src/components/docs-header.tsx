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
import { getAuthUrls, getAllAppUrls } from "@repo/url-utils";
import { ThemeToggle } from "./theme-toggle";
import { SearchTrigger } from "./search-trigger";

export function DocsHeader() {
	const authUrls = getAuthUrls();
	const appUrls = getAllAppUrls();

	return (
		<header className="h-14 flex items-center justify-between px-4 lg:px-6 bg-background">
			<div className="flex items-center">
				<Button variant="outline" size="xs" asChild>
					<Link href={appUrls.www}>
						<Icons.logoShort className="h-4 w-4" />
					</Link>
				</Button>
				<div className="flex h-4 items-center mx-4">
					<Separator orientation="vertical" />
				</div>

				{/* Navigation Menu */}
				<NavigationMenu className="hidden md:flex">
					<NavigationMenuList>
						{/* Documentation */}
						<NavigationMenuItem>
							<NavigationMenuTrigger
								className={buttonVariants({ variant: "ghost", size: "sm" })}
							>
								Documentation
							</NavigationMenuTrigger>
							<NavigationMenuContent>
								<div className="grid gap-2 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
									<Link
										href="/docs"
										className="row-span-3 from-muted/50 to-muted flex h-full w-full flex-col justify-end rounded-md bg-gradient-to-b p-6 no-underline outline-none select-none focus:shadow-md hover:opacity-90"
									>
										<div className="mt-4 mb-2 text-lg font-medium">
											Getting Started
										</div>
										<p className="text-muted-foreground text-sm leading-tight">
											Learn how to use Lightfast AI in your projects.
										</p>
									</Link>
									<Link
										href="/docs/api"
										className="block p-3 hover:bg-accent rounded-md"
									>
										<div className="text-sm font-medium leading-none">
											API Reference
										</div>
										<p className="text-muted-foreground line-clamp-2 text-sm leading-snug mt-1">
											Complete API documentation and examples.
										</p>
									</Link>
									<Link
										href="/docs/guides"
										className="block p-3 hover:bg-accent rounded-md"
									>
										<div className="text-sm font-medium leading-none">
											Guides
										</div>
										<p className="text-muted-foreground line-clamp-2 text-sm leading-snug mt-1">
											Step-by-step tutorials and best practices.
										</p>
									</Link>
								</div>
							</NavigationMenuContent>
						</NavigationMenuItem>

						{/* Products */}
						<NavigationMenuItem>
							<NavigationMenuTrigger
								className={buttonVariants({ variant: "ghost", size: "sm" })}
							>
								Products
							</NavigationMenuTrigger>
							<NavigationMenuContent>
								<div className="grid gap-2 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-2">
									<Link
										href={appUrls.chat}
										target="_blank"
										rel="noopener noreferrer"
										className="block p-3 hover:bg-accent rounded-md"
									>
										<div className="text-sm font-medium leading-none">Chat</div>
										<p className="text-muted-foreground line-clamp-2 text-sm leading-snug mt-1">
											Interactive AI chat experiences.
										</p>
									</Link>
									<Link
										href={appUrls.app}
										className="block p-3 hover:bg-accent rounded-md"
									>
										<div className="text-sm font-medium leading-none">
											Dashboard
										</div>
										<p className="text-muted-foreground line-clamp-2 text-sm leading-snug mt-1">
											Manage your AI applications.
										</p>
									</Link>
								</div>
							</NavigationMenuContent>
						</NavigationMenuItem>

						{/* Pricing */}
						<NavigationMenuItem>
							<Link
								href="/pricing"
								className={buttonVariants({ variant: "ghost", size: "sm" })}
							>
								Pricing
							</Link>
						</NavigationMenuItem>
					</NavigationMenuList>
				</NavigationMenu>
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

