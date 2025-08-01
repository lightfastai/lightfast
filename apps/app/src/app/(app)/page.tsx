import { auth } from "@clerk/nextjs/server";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";

export default async function HomePage() {
  const { userId } = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Lightfast App</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Ready to build your agent applications with lightning speed
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
            </CardHeader>
            <CardContent>
              {userId ? (
                <div className="flex items-center justify-center gap-4">
                  <span>Welcome! You're logged in</span>
                  <UserButton />
                </div>
              ) : (
                <div>
                  <p className="mb-4">Please sign in to continue</p>
                  <SignInButton mode="modal">
                    <Button>Sign In</Button>
                  </SignInButton>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Application Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1">
                <p>✅ Connected to subdomain</p>
                <p>✅ Clerk authentication active</p>
                <p>✅ Ready for agent development</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>This is the main Lightfast application running on app.lightfast.ai</p>
          <p>Authentication flows through auth.lightfast.ai via Clerk subdomains</p>
        </div>
      </div>
    </main>
  );
}