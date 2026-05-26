import React from "react";
import { describe, expect, it, vi } from "vitest";

interface Kids {
  children?: React.ReactNode;
}

const prefetch = vi.fn(() => {
  throw new Error("root app layout must not prefetch shell data");
});

vi.mock("@repo/app-trpc/react", () => ({
  TRPCReactProvider: ({ children }: Kids) => <>{children}</>,
}));

vi.mock("@repo/app-trpc/server", () => ({
  HydrateClient: ({ children }: Kids) => <>{children}</>,
  prefetch,
  trpc: {
    viewer: {
      account: {
        get: {
          queryOptions: () => ({ queryKey: ["viewer", "account", "get"] }),
        },
      },
      organization: {
        listUserOrganizations: {
          queryOptions: () => ({
            queryKey: ["viewer", "organization", "listUserOrganizations"],
          }),
        },
      },
    },
  },
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock("nuqs/adapters/next/app", () => ({
  NuqsAdapter: ({ children }: Kids) => <>{children}</>,
}));

vi.mock("~/components/errors/page-error-boundary", () => ({
  PageErrorBoundary: ({ children }: Kids) => <>{children}</>,
}));

const { default: AppLayout } = await import("~/app/(app)/layout");

function containsText(node: unknown, text: string): boolean {
  if (!React.isValidElement(node)) {
    return false;
  }

  const props = node.props as { children?: React.ReactNode };
  return React.Children.toArray(props.children).some((child) =>
    typeof child === "string" ? child.includes(text) : containsText(child, text)
  );
}

describe("root app layout", () => {
  it("provides app-level wrappers without prefetching shell-only data", () => {
    const element = AppLayout({ children: <main>OAuth handoff</main> });

    expect(prefetch).not.toHaveBeenCalled();
    expect(containsText(element, "OAuth handoff")).toBe(true);
  });
});
