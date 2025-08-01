import { auth } from "@clerk/nextjs/server";
import { SignInButton, UserButton } from "@clerk/nextjs";

export default async function HomePage() {
  const { userId } = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Lightfast App</h1>
        <p className="text-lg text-gray-300 mb-8">
          Ready to build your agent applications with lightning speed
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-2">Authentication</h2>
            <div className="text-gray-300">
              {userId ? (
                <div className="flex items-center justify-center gap-4">
                  <span>Welcome! You're logged in</span>
                  <UserButton />
                </div>
              ) : (
                <div>
                  <p className="mb-4">Please sign in to continue</p>
                  <SignInButton mode="modal">
                    <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white">
                      Sign In
                    </button>
                  </SignInButton>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-2">Application Status</h2>
            <p className="text-gray-300">
              ✅ Connected to satellite domain<br/>
              ✅ Clerk authentication active<br/>
              ✅ Ready for agent development
            </p>
          </div>
        </div>

        <div className="text-sm text-gray-400">
          <p>This is the main Lightfast application running on app.lightfast.ai</p>
          <p>Authentication flows through auth.lightfast.ai via Clerk satellite domains</p>
        </div>
      </div>
    </main>
  );
}