"use client";

import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex w-full flex-col items-center gap-12 overflow-hidden">
        <SignIn
          forceRedirectUrl="http://localhost:4100"
          signUpUrl="/sign-up"
          appearance={{
            elements: {
              card: "bg-background border-b border-border rounded-none",
              cardBox: "border border-border rounded-lg",
              headerTitle: "text-foreground text-lg",
              headerSubtitle: "text-muted-foreground text-xs",
              socialButtons:
                "border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md",
              // formButtonPrimary: "bg-primary text-primary-foreground",
              button: "border border-border text-foreground h-10 px-4 py-2",
              footer: {
                background: "none",
              },
              dividerText: "text-muted-foreground",
              footerAction: "bg-background",
              footerActionLink: "text-foreground",
              // input: "border border-border bg-transparent",
              formFieldInput:
                "border border-border bg-transparent rounded-md h-10 px-3 py-2",
              formFieldLabel: "text-muted-foreground",
              formButtonPrimary:
                "bg-background border border-border text-foreground rounded-md transition-all duration-200  hover:bg-accent hover:text-accent-foreground",
            },
          }}
        />
      </div>
    </div>
  );
}
