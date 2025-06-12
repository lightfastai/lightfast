import { Suspense } from "react"
import { fetchQuery } from "convex/nextjs"
import { api } from "../../../convex/_generated/api"
import { SimplifiedChatSidebar } from "./ChatSidebar"
import { SidebarSkeleton } from "./SidebarSkeleton"
import dynamic from "next/dynamic"

const ClientSidebarFallback = dynamic(
  () => import("./ClientSidebar").then((mod) => mod.ClientSidebar),
  {
    ssr: true,
  },
)

// Server component wrapper for the sidebar that fetches threads
export async function ServerSidebar() {
  return (
    <Suspense fallback={<SidebarSkeleton />}>
      <SidebarWithData />
    </Suspense>
  )
}

// Server component that fetches the threads data
async function SidebarWithData() {
  try {
    // Fetch threads on the server - this will be cached and streamed with PPR
    const threads = await fetchQuery(api.threads.list)

    return <SimplifiedChatSidebar threads={threads} />
  } catch (error) {
    // Fallback to client-side loading if server fetch fails
    console.warn(
      "Server-side thread fetch failed, falling back to client:",
      error,
    )
    return <SidebarFallback />
  }
}

// Fallback component that uses client-side data fetching
function SidebarFallback() {
  return (
    <Suspense fallback={<SidebarSkeleton />}>
      <ClientSidebarFallback />
    </Suspense>
  )
}
