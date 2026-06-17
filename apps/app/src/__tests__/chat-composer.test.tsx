// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/ui-v2/components/ai-elements/prompt-input", () => ({
  PromptInput: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => <form className={className}>{children}</form>,
  PromptInputBody: ({ children }: { children?: ReactNode }) => <>{children}</>,
  PromptInputStart: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-align="inline-start">
      {children}
    </div>
  ),
  PromptInputFooter: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-align="inline-end">
      {children}
    </div>
  ),
  PromptInputSubmit: ({
    children,
    onStop: _onStop,
    ...props
  }: {
    children?: ReactNode;
    onStop?: () => void;
  }) => (
    <button type="submit" {...props}>
      {children}
    </button>
  ),
  PromptInputButton: ({ children, ...props }: { children?: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  PromptInputTextarea: (
    props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
  ) => <textarea {...props} />,
  PromptInputTools: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@repo/ui/components/ui/input-group", () => ({
  InputGroupAddon: ({
    align = "inline-start",
    children,
    className,
  }: {
    align?: string;
    children?: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-align={align}>
      {children}
    </div>
  ),
}));

vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({ children, ...props }: { children?: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@repo/ui/components/ui/toggle", () => ({
  Toggle: ({
    children,
    onPressedChange: _onPressedChange,
    pressed,
    ...props
  }: {
    children?: ReactNode;
    onPressedChange?: (pressed: boolean) => void;
    pressed?: boolean;
  }) => (
    <button aria-pressed={pressed ? "true" : "false"} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@repo/ui/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const { ChatComposer } = await import("~/chat/chat-composer");

afterEach(() => {
  cleanup();
});

const baseProps = {
  error: undefined,
  onSubmit: vi.fn(),
  onTextChange: vi.fn(),
  onWriteModeChange: vi.fn(),
  status: "ready" as const,
  stop: vi.fn(),
  text: "",
  writeModeEnabled: false,
};

describe("ChatComposer", () => {
  it("renders a stable native prompt input slot structure", () => {
    const { container } = render(<ChatComposer {...baseProps} />);

    expect(
      screen.getByPlaceholderText("Ask Lightfield").getAttribute("rows")
    ).toBe("1");
    expect(
      container.querySelector('[data-align="inline-start"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-align="inline-end"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-align="block-end"]')).toBeNull();
    expect(container.querySelector("form")?.className).not.toContain(
      "data-[multiline="
    );
    expect(container.querySelector("form")?.className).not.toMatch(
      /(?:^|\s)shadow-(?!none\b)\S+/
    );
    expect(screen.getByLabelText("Add context").className).not.toMatch(
      /(?:^|\s)size-\d/
    );
    expect(screen.getByLabelText("Write mode").className).not.toMatch(
      /(?:^|\s)size-\d/
    );
    expect(screen.getByLabelText("Send message").className).not.toMatch(
      /(?:^|\s)size-\d/
    );
    expect(
      screen.getByPlaceholderText("Ask Lightfield").className
    ).not.toContain("min-h-6");
    expect(
      screen.getByPlaceholderText("Ask Lightfield").className
    ).not.toContain("group-data-[multiline=");
    expect(screen.getByPlaceholderText("Ask Lightfield").className).not.toMatch(
      /(?:^|\s)pr-\d(?:\s|$)/
    );
    expect(screen.getByPlaceholderText("Ask Lightfield").className).not.toMatch(
      /(?:^|\s)px-1(?:\s|$)/
    );
    expect(
      container.querySelector('[data-align="inline-start"]')?.className
    ).toContain("py-1.5");
    expect(
      container.querySelector('[data-align="inline-end"]')?.className
    ).toContain("py-1.5");
  });
});
