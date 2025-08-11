"use client";

import { MessageSquare } from "lucide-react";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import { ActiveMenuItem } from "./active-menu-item";
import { cn } from "@repo/ui/lib/utils";
import { ComponentProps } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

interface SessionsListProps extends ComponentProps<"div"> {}

export function SessionsList({ className, ...props }: SessionsListProps) {
	const trpc = useTRPC();
	const { data: sessions } = useSuspenseQuery(
		trpc.chat.session.list.queryOptions({
			limit: 50,
			offset: 0,
		}),
	);

	return (
		<div className={cn("overflow-y-auto", className)} {...props}>
			<SidebarGroup>
				<SidebarGroupContent>
					<SidebarMenu>
						{sessions.length === 0 && (
							<div className="px-2 py-4 text-center text-sm text-muted-foreground">
								No conversations yet
							</div>
						)}

						{sessions.map((session: any) => (
							<SidebarMenuItem key={session.id}>
								<ActiveMenuItem
									sessionId={session.id}
									href={`/${session.id}`}
									size="sm"
								>
									<MessageSquare className="w-4 h-4" />
									<span className="flex-1 truncate text-xs">New Chat</span>
								</ActiveMenuItem>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</div>
	);
}
