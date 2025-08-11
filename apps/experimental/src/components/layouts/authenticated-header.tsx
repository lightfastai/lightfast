import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { Icons } from "@repo/ui/components/icons";
import { getAppUrl } from "@repo/url-utils";
import { UserDropdown } from "../user-dropdown";
import { AuthenticatedMobileNav } from "./authenticated-mobile-nav";
import { AgentInfoModal } from "../agent-info-modal";

interface AuthenticatedHeaderProps {
	agentId?: string;
	version?: "v1" | "v2";
}

export function AuthenticatedHeader({ agentId, version = "v1" }: AuthenticatedHeaderProps) {
	const cloudUrl = getAppUrl("cloud");
	const chatUrl = getAppUrl("chat");
	const newChatHref = version === "v2" ? `/v2-chat/${agentId || "a011"}` : "/";

	return (
		<header className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between app-container bg-background border-b border-border/50 lg:border-b-0 z-10">
			{/* Left side - Logo and New Chat */}
			<div className="flex items-center">
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
						<Link href={newChatHref}>
							<Icons.newChat className="h-4 w-4" />
						</Link>
					</Button>
				</div>
			</div>

			{/* Right side */}
			<div className="flex items-center gap-2">
				{/* Agent Info Modal */}
				<AgentInfoModal agentId={agentId} />
				
				{/* Mobile menu button */}
				<AuthenticatedMobileNav agentId={agentId} version={version} />
				
				{/* Desktop - User dropdown */}
				<div className="hidden lg:block">
					<UserDropdown />
				</div>
			</div>
		</header>
	);
}