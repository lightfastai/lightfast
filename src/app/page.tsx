import { redirect } from "next/navigation"
import { Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isAuthenticated } from "@/lib/auth"
import Link from "next/link"
import { LandingChatInput } from "@/components/landing/LandingChatInput"

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

// Server-side header component for unauthenticated users
function LandingHeader() {
  return (
    <header className="bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <LightfastLogo className="w-6 h-5 text-foreground" />
          </Link>
        </div>
        <Link href="/signin">
          <Button variant="outline">Sign In</Button>
        </Link>
      </div>
    </header>
  )
}

// Landing page component for unauthenticated users
function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      {/* Main content */}
      <main className="container mx-auto px-4 py-48">
        <div className="max-w-4xl mx-auto">
          {/* Hero section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-muted/50 border rounded-full px-4 py-2 text-sm text-muted-foreground mb-6">
              <Zap className="w-4 h-4" />
              Agent-first approach to chats.
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              What makes a good chat?
            </h1>
          </div>

          {/* Chat input preview */}
          <div className="max-w-4xl mx-auto">
            <LandingChatInput />
          </div>
        </div>
      </main>
    </div>
  )
}

// Main server component that handles authentication routing
export default async function Home() {
  // Check authentication server-side
  const authenticated = await isAuthenticated()

  // If user is authenticated, redirect to chat
  if (authenticated) {
    redirect("/chat")
  }

  // Show landing page for unauthenticated users
  return <LandingPage />
}
