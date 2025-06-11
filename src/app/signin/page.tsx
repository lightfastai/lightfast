"use client"
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react"

export default function SignInPage() {
  return (
    <div className="flex justify-center items-center h-screen">
      <Authenticated>
        <div>Authenticated</div>
      </Authenticated>
      <Unauthenticated>
        <div>Unauthenticated</div>
      </Unauthenticated>
      <AuthLoading>Loading...</AuthLoading>
    </div>
  )
}
