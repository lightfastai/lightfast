"use client"

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Github } from "lucide-react"
import { SignInButton } from "./SignInButton"
import Link from "next/link"

interface SignInDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignInDialog({ open, onOpenChange }: SignInDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 bg-transparent border-none shadow-none">
        <DialogTitle className="sr-only">Sign In</DialogTitle>
        <DialogDescription className="sr-only">
          Sign in to access your AI chat conversations
        </DialogDescription>
        <Card className="shadow-xl bg-background/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold mb-2">
                Sign in to continue
              </h2>
              <p className="text-muted-foreground text-sm">
                Access your AI chat conversations
              </p>
            </div>

            <SignInButton
              className="w-full h-12 text-base font-medium relative overflow-hidden group"
              size="lg"
              onSignInComplete={() => onOpenChange(false)}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <Github className="w-5 h-5 mr-2" />
              Continue with GitHub
            </SignInButton>

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
      </DialogContent>
    </Dialog>
  )
}
