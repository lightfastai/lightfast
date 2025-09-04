import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { User, Key, CreditCard, Shield, ArrowRight } from "lucide-react";

const quickActions = [
  {
    title: "Update Profile",
    description: "Change your name, email, and profile picture",
    href: "/settings/profile",
    icon: User,
  },
  {
    title: "Manage API Keys",
    description: "Create, view, and revoke API keys for your applications",
    href: "/settings/api-keys",
    icon: Key,
  },
  {
    title: "Billing & Usage",
    description: "View your current plan and billing information",
    href: "/settings/billing",
    icon: CreditCard,
  },
  {
    title: "Security Settings",
    description: "Update your password and security preferences",
    href: "/settings/security",
    icon: Shield,
  },
];

export default async function SettingsPage() {
  const user = await currentUser();

  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Account Overview</h2>
          <p className="text-muted-foreground text-sm">
            Welcome back, {user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? "User"}. 
            Manage your account settings and preferences from the options below.
          </p>
        </div>

        {/* Account Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account Information</CardTitle>
            <CardDescription>
              Basic information about your Lightfast Cloud account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>
                <span className="ml-2 font-medium">
                  {user?.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}` 
                    : user?.firstName ?? "Not set"
                  }
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>
                <span className="ml-2 font-medium">
                  {user?.emailAddresses[0]?.emailAddress ?? "Not set"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Member since:</span>
                <span className="ml-2 font-medium">
                  {user?.createdAt 
                    ? new Date(user.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    : "Unknown"
                  }
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Plan:</span>
                <span className="ml-2 font-medium">
                  Free Tier
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card key={action.href} className="group hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-accent rounded-lg group-hover:bg-accent/80 transition-colors">
                        <Icon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm mb-1">{action.title}</h4>
                        <p className="text-muted-foreground text-xs mb-3 line-clamp-2">
                          {action.description}
                        </p>
                        <Button 
                          asChild 
                          variant="outline" 
                          size="sm"
                          className="text-xs h-7"
                        >
                          <Link href={action.href}>
                            Go to {action.title.toLowerCase()}
                            <ArrowRight className="size-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Recent Activity - Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>
              Your recent account and usage activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No recent activity to display</p>
              <p className="text-xs mt-1">
                Activity will appear here as you use Lightfast Cloud
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}