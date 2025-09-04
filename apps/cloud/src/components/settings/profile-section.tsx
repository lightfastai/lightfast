"use client";

import { UserProfile } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";

export function ProfileSection() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Profile Settings</h2>
        <p className="text-muted-foreground text-sm">
          Manage your personal information and account preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal Information</CardTitle>
          <CardDescription>
            Update your profile information, email addresses, and security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Clerk UserProfile component with custom appearance */}
          <div className="clerk-profile-wrapper">
            <UserProfile
              appearance={{
                elements: {
                  card: "shadow-none border-0 bg-transparent",
                  navbar: "hidden",
                  navbarMobileMenuButton: "hidden",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  profileSectionPrimaryButton: "bg-primary text-primary-foreground hover:bg-primary/90",
                  formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
                  footerActionLink: "text-primary hover:text-primary/90",
                },
                variables: {
                  colorPrimary: "#3b82f6",
                  colorBackground: "transparent",
                  colorInputBackground: "#18181b",
                  colorInputText: "#fafafa",
                  colorText: "#fafafa",
                  colorTextSecondary: "#a1a1aa",
                  borderRadius: "0.5rem",
                },
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Organization Settings - if applicable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Organization Settings</CardTitle>
          <CardDescription>
            Manage your organization membership and settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No organization memberships</p>
            <p className="text-xs mt-1">
              You can create or join organizations to collaborate with team members
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}