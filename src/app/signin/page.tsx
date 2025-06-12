import { Card, CardContent } from "@/components/ui/card"
import { Github, UserIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { SignInButton } from "../../components/auth/SignInButton"
import { redirect } from "next/navigation"
import { isAuthenticated } from "../../lib/auth"
import { AuthRedirectHandler } from "../../components/auth/AuthRedirectHandler"
import { isDevelopment, isVercelPreview } from "@/env"

export const metadata: Metadata = {
  title: "Sign In - Lightfast",
  description:
    "Sign in to access your AI chat conversations with real-time streaming responses.",
  keywords: [
    "AI chat",
    "sign in",
    "authentication",
    "GitHub OAuth",
    "real-time chat",
  ],
  openGraph: {
    title: "Sign In - AI Chat",
    description:
      "Sign in to access your AI chat conversations with real-time streaming responses.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Sign In - AI Chat",
    description:
      "Sign in to access your AI chat conversations with real-time streaming responses.",
  },
}

// Server-rendered signin page
function SignInPageContent() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl bg-background">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold mb-2">
                Sign in to continue
              </h2>
              <p className="text-muted-foreground text-sm">
                Access your AI chat conversations
              </p>
            </div>

            <div className="space-y-3">
              {/* Hide GitHub login in Vercel previews */}
              {!isVercelPreview() && (
                <SignInButton size="lg" className="w-full" provider="github">
                  <Github className="w-5 h-5 mr-2" />
                  Continue with GitHub
                </SignInButton>
              )}

              {/* Show anonymous login in all non-production environments */}
              {(isVercelPreview() || isDevelopment()) && (
                <SignInButton size="lg" className="w-full" provider="anonymous">
                  <UserIcon className="w-5 h-5 mr-2" />
                  Continue as Guest
                </SignInButton>
              )}
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                By signing in, you agree to our{" "}
                <Link
                  href="https://lightfast.ai/legal/terms"
                  target="_blank"
                  className="underline"
                >
                  terms
                </Link>{" "}
                and{" "}
                <Link
                  href="https://lightfast.ai/legal/privacy"
                  target="_blank"
                  className="underline"
                >
                  privacy policy
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default async function SignInPage() {
  const [authenticated] = await Promise.all([isAuthenticated()])

  if (authenticated) {
    redirect("/chat")
  }

  return (
    <>
      {/* Client component handles auth redirects for authenticated users */}
      <AuthRedirectHandler redirectTo="/chat" />

      {/* Server-rendered signin page */}
      <SignInPageContent />
    </>
  )
}
