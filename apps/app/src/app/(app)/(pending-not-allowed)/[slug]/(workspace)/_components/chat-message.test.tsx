import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useReducer } from "react";
import { describe, expect, it, vi } from "vitest";

let messageResponseRenderCount = 0;

vi.mock("@repo/ui/components/ai-elements/message", () => ({
  Message: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  MessageContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  MessageResponse: ({ children }: { children?: ReactNode }) => {
    messageResponseRenderCount += 1;
    return <div>{children}</div>;
  },
  MessageActions: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  MessageAction: ({
    children,
    label,
  }: {
    children?: ReactNode;
    label?: string;
  }) => (
    <button aria-label={label} type="button">
      {children}
    </button>
  ),
}));

vi.mock("@repo/ui/components/ai-elements/reasoning", () => ({
  Reasoning: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ReasoningContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  ReasoningTrigger: () => <button type="button">Reasoning</button>,
}));

vi.mock("@repo/ui/components/ai-elements/tool", () => ({
  Tool: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ToolContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  ToolHeader: () => <button type="button">Tool</button>,
  ToolInput: () => <div>Tool input</div>,
  ToolOutput: () => <div>Tool output</div>,
}));

const { ChatMessage } = await import("./chat-message");

function Harness({
  message,
}: {
  message: Parameters<typeof ChatMessage>[0]["message"];
}) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  return (
    <>
      <button onClick={() => force()} type="button">
        force
      </button>
      <ChatMessage isStreaming={false} message={message} />
    </>
  );
}

describe("ChatMessage memoization", () => {
  it("does not re-render a completed message when the parent re-renders", () => {
    messageResponseRenderCount = 0;
    const message = {
      id: "msg_assistant",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "Stable answer" }],
    };

    render(<Harness message={message} />);
    expect(messageResponseRenderCount).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "force" }));
    fireEvent.click(screen.getByRole("button", { name: "force" }));

    expect(messageResponseRenderCount).toBe(1);
  });
});
