"use client"
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react"
import { useAuthActions } from "@convex-dev/auth/react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useRouter } from "next/navigation"

export default function SignInPage() {
  const { signIn, signOut } = useAuthActions()
  const router = useRouter()

  const handleGitHubSignIn = () => {
    void signIn("github")
  }

  const handleSignOut = () => {
    void signOut()
  }

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <AuthLoading>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>
              Please wait while we authenticate you.
            </CardDescription>
          </CardHeader>
        </Card>
      </AuthLoading>

      <Unauthenticated>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Sign in to your account to access the chat application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleGitHubSignIn} className="w-full" size="lg">
              Sign in with GitHub
            </Button>
          </CardContent>
        </Card>
      </Unauthenticated>

      <Authenticated>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome!</CardTitle>
            <CardDescription>You are successfully signed in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => router.push("/")}
              className="w-full"
              size="lg"
            >
              Go to Chat
            </Button>
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="w-full"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </Authenticated>
    </div>
  )
}
