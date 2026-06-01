import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/sign-in";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("@vercel/microfrontends/next/client", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { default: AuthLayout } = await import("~/app/(auth)/layout");

describe("auth layout header CTA", () => {
  beforeEach(() => {
    pathname = "/sign-in";
  });

  it("renders a Sign up header link on /sign-in", () => {
    render(
      <AuthLayout>
        <div />
      </AuthLayout>
    );

    expect(screen.getByRole("link", { name: /^sign up$/i })).toHaveAttribute(
      "href",
      "/sign-up"
    );
  });

  it("renders a Log in header link on /sign-up", () => {
    pathname = "/sign-up";

    render(
      <AuthLayout>
        <div />
      </AuthLayout>
    );

    expect(screen.getByRole("link", { name: /^log in$/i })).toHaveAttribute(
      "href",
      "/sign-in"
    );
  });

  it("renders a Log in header link on /sign-up/accept-invitation", () => {
    pathname = "/sign-up/accept-invitation";

    render(
      <AuthLayout>
        <div />
      </AuthLayout>
    );

    expect(screen.getByRole("link", { name: /^log in$/i })).toHaveAttribute(
      "href",
      "/sign-in"
    );
  });
});
