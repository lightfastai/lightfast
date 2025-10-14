import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { Icons } from "@repo/ui/components/icons";
import { UserDropdown } from "../user-dropdown";
import { AuthenticatedMobileNav } from "./authenticated-mobile-nav";
import { AgentInfoModal } from "../agent-info-modal";

interface AuthenticatedHeaderProps {
	agentId?: string;
	version?: "v1" | "v2";
}

export function AuthenticatedHeader({ agentId, version = "v1" }: AuthenticatedHeaderProps) {
	const newChatHref = version === "v2" ? `/v2-chat/${agentId || "a011"}` : "/";

	return (
		<>
			{/* Mobile/iPad header - traditional header with background */}
			<header className="lg:hidden absolute top-0 left-0 right-0 h-14 flex items-center justify-between app-container bg-background border-b border-border/50 z-10">
				<div className="flex items-center">
					<Button variant="outline" size="xs" asChild>
						<Link href="/">
							<Icons.logoShort className="h-4 w-4" />
						</Link>
					</Button>
					
					<div className="flex items-center">
						<div className="flex h-4 items-center px-4">
							<Separator orientation="vertical" />
						</div>
						<Button size="xs" variant="ghost" asChild>
							<Link href={newChatHref}>
								<Icons.newChat className="h-4 w-4" />
							</Link>
						</Button>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<AgentInfoModal agentId={agentId} />
					<AuthenticatedMobileNav agentId={agentId} version={version} />
				</div>
			</header>

			{/* Desktop floating elements - no background, elements float over content */}
			<div className="hidden lg:block">
				{/* Top left floating elements */}
				<div className="fixed top-4 left-4 z-20 flex items-center">
					<Button variant="outline" size="xs" asChild className="bg-background/80 backdrop-blur-sm">
						<Link href="/">
							<Icons.logoShort className="h-4 w-4" />
						</Link>
					</Button>
					<div className="flex h-4 items-center px-4">
						<Separator orientation="vertical" className="bg-border/50" />
					</div>
					<Button size="xs" variant="ghost" asChild className="bg-background/80 backdrop-blur-sm">
						<Link href={newChatHref}>
							<Icons.newChat className="h-4 w-4" />
						</Link>
					</Button>
				</div>

				{/* Top right floating elements */}
				<div className="fixed top-4 right-4 z-20 flex items-center">
					<AgentInfoModal agentId={agentId} />
					<div className="flex h-4 items-center px-4">
						<Separator orientation="vertical" className="bg-border/50" />
					</div>
					<UserDropdown />
				</div>
			</div>
		</>
	);
}