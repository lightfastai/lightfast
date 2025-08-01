import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAllAppUrls } from "@repo/url-utils";

export default async function HomePage() {
  const { userId } = await auth();
  
  // If not authenticated, redirect to sign-in
  if (!userId) {
    redirect("/sign-in");
  }

  const urls = getAllAppUrls();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Lightfast Authentication</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        You're successfully authenticated
      </p>
      
      <div className="mt-8 flex items-center gap-4">
        <span>Welcome back!</span>
        <UserButton />
      </div>

      <div className="mt-8 flex flex-col gap-4 text-center">
        <p className="text-sm text-muted-foreground">Continue to:</p>
        <div className="flex gap-4">
          <Link 
            href={urls.app}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go to App
          </Link>
          <Link 
            href={urls.www}
            className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}