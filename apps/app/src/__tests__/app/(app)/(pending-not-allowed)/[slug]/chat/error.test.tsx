import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

const captureExceptionMock = vi.fn();
const resetMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/acme/chat/conv_123",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { default: ChatError } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/chat/error"
);

describe("workspace chat error boundary", () => {
  it("captures chat route errors and lets the user retry or start a new chat", () => {
    const error = Object.assign(new Error("load failed"), {
      digest: "digest-123",
    });

    render(<ChatError error={error} reset={resetMock} />);

    expect(captureExceptionMock).toHaveBeenCalledWith(error, {
      extra: { errorDigest: "digest-123" },
      tags: { route: "workspace-chat" },
    });
    expect(
      screen.getByRole("heading", { name: "Couldn't load this chat" })
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(resetMock).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "New chat" })).toHaveAttribute(
      "href",
      "/acme/chat"
    );
  });
});
