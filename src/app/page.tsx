import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { MessageCircle, User, Zap } from "lucide-react"
import { SignInButton } from "@/components/auth/SignInButton"
import { isAuthenticated } from "@/lib/auth"

// Server-side header component for unauthenticated users
function LandingHeader() {
  return (
    <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">AI Chat</span>
        </div>
        <SignInButton />
      </div>
    </header>
  )
}

// Landing page component for unauthenticated users
function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <LandingHeader />

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2 text-sm text-muted-foreground mb-6">
              <Zap className="w-4 h-4" />
              Powered by GPT-4o-mini • Real-time streaming
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Chat with AI
              <span className="block text-muted-foreground">in real-time</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Experience the future of AI conversation with real-time streaming
              responses, persistent chat history, and a beautiful interface.
            </p>
          </div>

          {/* Chat input preview */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Textarea
                placeholder="Ask anything... (Sign in to start chatting)"
                className="min-h-[120px] resize-none pr-16 text-lg border-2 transition-colors focus:border-primary"
                rows={4}
                disabled
              />
              <div className="absolute right-3 bottom-3 h-12 w-12 bg-muted rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>

            <div className="mt-4 text-center">
              <SignInButton />
              <p className="text-sm text-muted-foreground mt-2">
                Sign in with GitHub to start chatting with AI
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="mt-20 grid md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Real-time Streaming</h3>
                <p className="text-sm text-muted-foreground">
                  Watch AI responses appear character by character as they're
                  generated
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Persistent History</h3>
                <p className="text-sm text-muted-foreground">
                  All your conversations are saved and organized by topic
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Secure & Private</h3>
                <p className="text-sm text-muted-foreground">
                  Your conversations are private and secured with GitHub
                  authentication
                </p>
              </CardContent>
            </Card>
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
