import { Suspense } from "react"
import { SimplifiedChatSidebar } from "./ChatSidebar"
import { SidebarSkeleton } from "./SidebarSkeleton"
import { ClientSidebar } from "./ClientSidebar"
import { env } from "../../env"
import { getAuthToken } from "../../lib/auth"

// Server component wrapper for the sidebar that fetches threads
export async function ServerSidebar() {
  return (
    <Suspense fallback={<SidebarSkeleton />}>
      <SidebarWithData />
    </Suspense>
  )
}

// Server component that handles data fetching with build-time safety
async function SidebarWithData() {
  // During build time, always fall back to client-side loading
  // This prevents build failures when the Convex backend isn't available
  if (env.NODE_ENV === "production" && !env.NEXT_PUBLIC_CONVEX_URL) {
    return <SidebarFallback />
  }

  try {
    // Get authentication token for server-side requests
    const token = await getAuthToken()

    // If no authentication token, fall back to client-side rendering
    if (!token) {
      return <SidebarFallback />
    }

    // Import fetchQuery dynamically to avoid issues during build
    const { fetchQuery } = await import("convex/nextjs")
    const { api } = await import("../../../convex/_generated/api")

    // Fetch threads on the server with authentication - this will be cached and streamed with PPR
    const threads = await fetchQuery(api.threads.list, {}, { token })

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
      <ClientSidebar />
    </Suspense>
  )
}
