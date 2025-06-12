"use client"

import { Button } from "@/components/ui/button"
import { useAuthActions } from "@convex-dev/auth/react"
import { LogIn } from "lucide-react"
import { cn } from "../../lib/utils"

interface SignInButtonProps {
  className?: string
  size?: "default" | "sm" | "lg" | "icon"
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
  provider?: "github" | "anonymous" // Extended to include anonymous
  children?: React.ReactNode
  onSignInStart?: () => void
  onSignInComplete?: () => void
}

export function SignInButton({
  className,
  size = "default",
  variant = "default",
  provider = "github",
  children,
  onSignInStart,
  onSignInComplete,
}: SignInButtonProps) {
  const { signIn } = useAuthActions()

  const handleSignIn = async () => {
    try {
      onSignInStart?.()
      await signIn(provider, { redirectTo: "/chat" })
      onSignInComplete?.()
    } catch (error) {
      console.error("Error signing in:", error)
    }
  }

  // Default content based on provider
  const getDefaultContent = () => {
    switch (provider) {
      case "anonymous":
        return (
          <>
            <LogIn className="w-4 h-4 mr-2" />
            Continue as Guest
          </>
        )
      case "github":
        return (
          <>
            <LogIn className="w-4 h-4 mr-2" />
            Sign in with GitHub
          </>
        )
    }
  }

  return (
    <Button
      onClick={handleSignIn}
      className={cn("w-full cursor-pointer", className)}
      size={size}
      variant={variant}
    >
      {children || getDefaultContent()}
    </Button>
  )
}
