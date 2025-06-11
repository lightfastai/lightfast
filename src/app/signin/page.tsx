"use client"

import {
  AuthWrapper,
  SignInButton,
  SignOutButton,
  useAuth,
} from "@/components/auth"
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
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <AuthWrapper
        loadingComponent={
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Loading...</CardTitle>
              <CardDescription>
                Please wait while we authenticate you.
              </CardDescription>
            </CardHeader>
          </Card>
        }
      >
        {isAuthenticated ? (
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
              <SignOutButton className="w-full" variant="outline">
                Sign Out
              </SignOutButton>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>
                Sign in to your account to access the chat application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SignInButton className="w-full" size="lg">
                Sign in with GitHub
              </SignInButton>
            </CardContent>
          </Card>
        )}
      </AuthWrapper>
    </div>
  )
}
