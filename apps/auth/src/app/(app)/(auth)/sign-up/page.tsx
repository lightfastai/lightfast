"use client";

import { notFound } from "next/navigation";
import { SignedOut, RedirectToTasks } from "@clerk/nextjs";
import { SignUpForm } from "../_components/sign-up-form";

/**
 * Dev-only Sign Up Page
 *
 * This page is only available in development to allow creating test accounts
 * for iterative testing of the organization creation flow.
 */
export default function SignUpPage() {
  // Only show sign-up in development environment
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full mb-4">
              DEV ONLY
            </div>
            <p className="text-sm text-muted-foreground">
              Create test accounts for development
            </p>
          </div>

          <SignUpForm />
        </div>
      </div>
    </>
  );
}

