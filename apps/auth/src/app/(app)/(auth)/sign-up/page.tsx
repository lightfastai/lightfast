"use client";

import { notFound } from "next/navigation";
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
      <SignUpForm />
    </>
  );
}

