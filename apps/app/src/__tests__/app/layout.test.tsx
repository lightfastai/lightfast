import { render } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let clerkProviderProps: Record<string, unknown> | undefined;

interface Kids {
  children?: React.ReactNode;
}

vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_123",
  },
}));

vi.mock("@vendor/clerk", () => ({
  ClerkProvider: ({ children, ...props }: Kids & Record<string, unknown>) => {
    clerkProviderProps = props;
    return <>{children}</>;
  },
}));

vi.mock("@vendor/analytics/vercel", () => ({
  SpeedInsights: () => null,
  VercelAnalytics: () => null,
}));

vi.mock("@vendor/seo/metadata", () => ({
  createMetadata: (input: unknown) => input,
}));

vi.mock("@repo/ui/lib/fonts", () => ({
  fonts: "geist-fonts",
}));

vi.mock("@repo/ui/lib/utils", () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
}));

vi.mock("~/lib/fonts", () => ({
  ppNeueMontreal: { variable: "pp-neue-montreal" },
}));

vi.mock("@vercel/microfrontends/next/client", () => ({
  PrefetchCrossZoneLinks: () => null,
  PrefetchCrossZoneLinksProvider: ({ children }: Kids) => <>{children}</>,
}));

const { default: RootLayout } = await import("~/app/layout");

describe("root layout ClerkProvider", () => {
  beforeEach(() => {
    clerkProviderProps = undefined;
  });

  it("configures Clerk auth URLs", () => {
    render(
      <RootLayout>
        <main>App</main>
      </RootLayout>
    );

    expect(clerkProviderProps).toMatchObject({
      afterSignOutUrl: "/sign-in",
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
    });
  });
});
