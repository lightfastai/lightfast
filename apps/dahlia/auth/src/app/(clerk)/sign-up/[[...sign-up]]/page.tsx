"use client";

import { SignUp } from "@vendor/clerk/client";

export default function Page() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex w-full flex-col items-center gap-12 overflow-hidden">
        <SignUp
          signInUrl="/sign-in"
          appearance={{
            elements: {
              card: "bg-background border-b border-border rounded-none",
              cardBox: "border border-border rounded-lg",
              headerTitle: "text-foreground",
              headerSubtitle: "text-muted-foreground",
              socialButtons:
                "border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md",
              formButtonPrimary: "bg-primary text-primary-foreground",
              button: "border border-border text-foreground",
              formFieldCheckboxLabel: "text-muted-foreground",
              footer: {
                background: "none",
              },
              footerAction: "bg-background",
              footerActionLink: "text-foreground",
            },
          }}
        />
      </div>
    </div>
  );
}
