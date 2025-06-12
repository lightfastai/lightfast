import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { Doc } from "../../../convex/_generated/dataModel"
import { UserDropdown } from "../auth/UserDropdown"

type Thread = Doc<"threads">

interface SimplifiedChatSidebarProps {
  threads: Thread[]
}

// Lightfast logo component
function LightfastLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="104"
      height="70"
      viewBox="0 0 104 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Lightfast"
      {...props}
    >
      <title>Lightfast</title>
      <path
        d="M15.3354 57.3195H47.1597V69.7863H0.543457V0.632019H15.3354V57.3195Z"
        fill="currentColor"
      />
      <path
        d="M79.6831 69.7863H65.2798L89.0532 0.658386H103.457L79.6831 69.7863Z"
        fill="currentColor"
      />
    </svg>
  )
}

function groupThreadsByDate(threads: Thread[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const groups: Record<string, Thread[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    "This Month": [],
    Older: [],
  }

  for (const thread of threads) {
    const threadDate = new Date(thread.lastMessageAt)

    if (threadDate >= today) {
      groups.Today.push(thread)
    } else if (threadDate >= yesterday) {
      groups.Yesterday.push(thread)
    } else if (threadDate >= weekAgo) {
      groups["This Week"].push(thread)
    } else if (threadDate >= monthAgo) {
      groups["This Month"].push(thread)
    } else {
      groups.Older.push(thread)
    }
  }

  return groups
}

export function SimplifiedChatSidebar({ threads }: SimplifiedChatSidebarProps) {
  const pathname = usePathname()
  const groupedThreads = groupThreadsByDate(threads)
  const categoryOrder = [
    "Today",
    "Yesterday",
    "This Week",
    "This Month",
    "Older",
  ]

  return (
    <Sidebar variant="inset" className="w-64">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <LightfastLogo className="w-6 h-6 text-foreground" />
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Link href="/chat" prefetch>
                  <SidebarMenuButton size="default" className="h-10 w-full">
                    <Plus className="w-4 h-4" />
                    <span>New Chat</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <ScrollArea className="h-[calc(100vh-280px)]">
          {threads.length === 0 ? (
            <div className="px-3 py-8 text-center text-muted-foreground">
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new chat to begin</p>
            </div>
          ) : (
            categoryOrder.map((category) => {
              const categoryThreads = groupedThreads[category]
              if (!categoryThreads || categoryThreads.length === 0) {
                return null
              }

              return (
                <SidebarGroup key={category}>
                  <SidebarGroupLabel className="text-xs font-medium text-muted-foreground">
                    {category}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="space-y-0.5">
                      {categoryThreads.map((thread) => {
                        const isActive = pathname === `/chat/${thread._id}`

                        return (
                          <SidebarMenuItem key={thread._id}>
                            <Link
                              href={`/chat/${thread._id}`}
                              prefetch={true} // Aggressive prefetching for better UX
                            >
                              <SidebarMenuButton
                                isActive={isActive}
                                className="w-full h-auto p-2.5 text-left"
                                size="default"
                              >
                                <span
                                  className={`truncate text-sm font-medium ${
                                    thread.isTitleGenerating
                                      ? "animate-pulse blur-[0.5px] opacity-70"
                                      : ""
                                  }`}
                                >
                                  {thread.title}
                                </span>
                              </SidebarMenuButton>
                            </Link>
                          </SidebarMenuItem>
                        )
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )
            })
          )}
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter>
        <UserDropdown className="w-full justify-start" />
      </SidebarFooter>
    </Sidebar>
  )
}
