import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to Lightfast Auth</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Authentication app powered by Clerk
      </p>
      <div className="mt-8 flex gap-4">
        <SignInButton>
          <button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Sign In
          </button>
        </SignInButton>
        <SignUpButton>
          <button className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">
            Sign Up
          </button>
        </SignUpButton>
      </div>
      <div className="mt-4">
        <UserButton />
      </div>
    </main>
  );
}