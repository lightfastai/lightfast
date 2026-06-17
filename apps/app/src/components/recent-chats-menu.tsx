import type { AppRouterOutputs } from "@api/app";
import {
  CollapseIcon,
  ExpandIcon,
  Message01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { cn } from "@repo/ui/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@repo/ui-v2/components/ui/dropdown-menu";
import { ScrollEdgeCues } from "@repo/ui-v2/components/ui/scroll-edge-cue";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useTRPC } from "~/trpc/react";

type WorkspaceAssistantConversationList =
  AppRouterOutputs["org"]["workspace"]["assistant"]["listConversations"];
type WorkspaceAssistantConversationListItem =
  WorkspaceAssistantConversationList["items"][number];

export function RecentChatsMenu({
  onConversationSelect,
  orgSlug,
  pathname,
  trigger,
}: {
  onConversationSelect?: () => void;
  orgSlug: string;
  pathname: string;
  trigger: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const trpc = useTRPC();
  const { data, error, isPending } = useQuery({
    ...trpc.org.workspace.assistant.listConversations.queryOptions(
      { limit: 20 },
      { staleTime: 0 }
    ),
    enabled: typeof window !== "undefined" && Boolean(orgSlug),
  });

  const conversations = data?.items ?? [];

  return (
    <DropdownMenu>
      {trigger}
      <DropdownMenuContent align="start" side="right" size="md">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2">
            <span>Recent Chats</span>
            <Button
              aria-expanded={expanded}
              aria-label={
                expanded ? "Collapse recent chats" : "Expand recent chats"
              }
              className="ml-auto"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setExpanded((value) => !value);
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <HugeiconsIcon
                aria-hidden="true"
                icon={expanded ? CollapseIcon : ExpandIcon}
              />
            </Button>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <ScrollEdgeCues>
          <ScrollArea
            className={cn(
              "overflow-hidden rounded-xl transition-[height] duration-200",
              expanded ? "h-80" : "h-40"
            )}
          >
            <div className="space-y-1">
              {isPending ? (
                <>
                  <Skeleton className="h-7 rounded-xl" />
                  <Skeleton className="h-7 rounded-xl" />
                  <Skeleton className="h-7 rounded-xl" />
                </>
              ) : error ? (
                <DropdownMenuItem disabled>
                  <span className="truncate text-muted-foreground">
                    Unable to load recents
                  </span>
                </DropdownMenuItem>
              ) : conversations.length > 0 ? (
                conversations.map((conversation) => (
                  <RecentChatsMenuItem
                    conversation={conversation}
                    key={conversation.publicId}
                    onConversationSelect={onConversationSelect}
                    orgSlug={orgSlug}
                    pathname={pathname}
                  />
                ))
              ) : (
                <DropdownMenuItem disabled>
                  <span className="truncate text-muted-foreground">
                    No recent chats
                  </span>
                </DropdownMenuItem>
              )}
            </div>
          </ScrollArea>
        </ScrollEdgeCues>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RecentChatsMenuItem({
  conversation,
  onConversationSelect,
  orgSlug,
  pathname,
}: {
  conversation: WorkspaceAssistantConversationListItem;
  onConversationSelect?: () => void;
  orgSlug: string;
  pathname: string;
}) {
  const href = `/${orgSlug}/chat/${conversation.publicId}`;
  const isActive = pathname === href;
  const title = getConversationSidebarTitle(conversation);

  return (
    <DropdownMenuItem
      className={cn(
        "grid w-full min-w-0 max-w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] overflow-hidden",
        isActive && "bg-accent text-accent-foreground"
      )}
      render={
        <Link
          aria-current={isActive ? "page" : undefined}
          onClick={onConversationSelect}
          params={{ conversationId: conversation.publicId, slug: orgSlug }}
          preload="intent"
          to="/$slug/chat/$conversationId"
        />
      }
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="size-3.5"
        icon={Message01Icon}
      />
      <span className="block min-w-0 truncate">{title}</span>
    </DropdownMenuItem>
  );
}

function getConversationSidebarTitle(
  conversation: WorkspaceAssistantConversationListItem
) {
  const title = conversation.title?.trim();
  return title || "Untitled chat";
}
