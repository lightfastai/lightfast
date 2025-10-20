import { buttonVariants } from "@repo/ui/components/ui/button";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@repo/ui/components/ui/navigation-menu";

export function AppHeaderNav() {
	return (
		<NavigationMenu>
			<NavigationMenuList>
				<NavigationMenuItem>
					<NavigationMenuTrigger
						className={buttonVariants({ variant: "ghost", size: "lg" })}
					>
						Lightfast Chat
					</NavigationMenuTrigger>
				</NavigationMenuItem>
			</NavigationMenuList>
		</NavigationMenu>
	);
}

