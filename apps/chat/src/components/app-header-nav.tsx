import Link from "next/link";
import { buttonVariants } from "@repo/ui/components/ui/button";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@repo/ui/components/ui/navigation-menu";

interface AppHeaderNavProps {
	cloudUrl: string;
}

export function AppHeaderNav({ cloudUrl }: AppHeaderNavProps) {
	return (
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
	);
}

