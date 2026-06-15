import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractMessageText,
  MessageCopyButton,
} from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/message-copy-button";

vi.mock("@repo/ui/components/ai-elements/message", () => ({
  MessageAction: ({
    children,
    label,
    onClick,
  }: {
    children?: ReactNode;
    label?: string;
    onClick?: () => void;
  }) => (
    <button onClick={onClick} type="button">
      {children}
      <span>{label}</span>
    </button>
  ),
}));

const writeText = vi.fn<(value: string) => Promise<void>>(() =>
  Promise.resolve()
);

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: { writeText },
});

beforeEach(() => {
  writeText.mockClear();
});

const message = (parts: unknown[]) =>
  ({ parts }) as unknown as Parameters<typeof extractMessageText>[0];

describe("extractMessageText", () => {
  it("joins text parts with blank lines and trims", () => {
    expect(
      extractMessageText(
        message([
          { type: "text", text: "Hello" },
          { type: "text", text: "World" },
        ])
      )
    ).toBe("Hello\n\nWorld");
  });

  it("ignores non-text parts", () => {
    expect(
      extractMessageText(
        message([
          { type: "text", text: "Keep" },
          { type: "reasoning", text: "Drop" },
          { type: "step-start" },
        ])
      )
    ).toBe("Keep");
  });

  it("returns an empty string when there is no text", () => {
    expect(extractMessageText(message([{ type: "step-start" }]))).toBe("");
  });
});

describe("MessageCopyButton", () => {
  it("copies the text and flips to a copied state", async () => {
    render(<MessageCopyButton text="copy me" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("copy me");
    expect(
      await screen.findByRole("button", { name: "Copied" })
    ).toBeInTheDocument();
  });

  it("stays on copy when the clipboard rejects", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    render(<MessageCopyButton text="copy me" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("copy me");
    // microtask flush — the rejected copy must not switch to "Copied"
    await Promise.resolve();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });
});
