// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useReducer, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

let messageRenderCount = 0;
let messageResponseRenderCount = 0;

vi.mock("@repo/ui-v2/components/ai-elements/message", () => ({
  Message: ({
    children,
    className,
    from,
  }: {
    children?: ReactNode;
    className?: string;
    from?: string;
  }) => {
    messageRenderCount += 1;
    return (
      <article className={className} data-from={from} data-testid="message">
        {children}
      </article>
    );
  },
  MessageActions: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="message-actions">
      {children}
    </div>
  ),
  MessageContent: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <section className={className} data-testid="message-content">
      {children}
    </section>
  ),
  MessageResponse: ({ children }: { children?: ReactNode }) => {
    messageResponseRenderCount += 1;
    return <div data-testid="message-response">{children}</div>;
  },
}));

vi.mock("@repo/ui-v2/components/ai-elements/reasoning", () => ({
  Reasoning: ({
    children,
    defaultOpen,
    isStreaming,
  }: {
    children?: ReactNode;
    defaultOpen?: boolean;
    isStreaming?: boolean;
  }) => (
    <div
      data-default-open={String(defaultOpen)}
      data-streaming={String(isStreaming)}
      data-testid="reasoning"
    >
      {children}
    </div>
  ),
  ReasoningContent: ({ children }: { children?: ReactNode }) => (
    <div data-testid="reasoning-content">{children}</div>
  ),
  ReasoningTrigger: () => <button type="button">Reasoning</button>,
}));

vi.mock("@repo/ui-v2/components/ai-elements/thinking-steps", () => ({
  ThinkingStep: ({
    children,
    description,
    label,
    status,
  }: {
    children?: ReactNode;
    description?: string;
    label: string;
    status?: string;
  }) => (
    <div data-status={status} data-testid="thinking-step">
      <span>{label}</span>
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  ),
  ThinkingStepDetails: ({
    children,
    details,
    summary,
  }: {
    children?: ReactNode;
    details?: string[];
    summary: string;
  }) => (
    <details data-testid="thinking-step-details">
      <summary>{summary}</summary>
      {details?.map((detail) => (
        <p key={detail}>{detail}</p>
      ))}
      {children}
    </details>
  ),
  ThinkingStepSource: ({ children }: { children?: ReactNode }) => (
    <span data-testid="thinking-step-source">{children}</span>
  ),
  ThinkingStepSources: ({ children }: { children?: ReactNode }) => (
    <div data-testid="thinking-step-sources">{children}</div>
  ),
  ThinkingSteps: ({ children }: { children?: ReactNode }) => (
    <div data-testid="thinking-steps">{children}</div>
  ),
  ThinkingStepsContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  ThinkingStepsHeader: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock("@repo/ui-v2/components/ai-elements/tool", () => ({
  Tool: ({
    children,
    defaultOpen,
  }: {
    children?: ReactNode;
    defaultOpen?: boolean;
  }) => {
    const [open] = useState(defaultOpen);
    return (
      <div data-default-open={String(open)} data-testid="tool">
        {children}
      </div>
    );
  },
  ToolContent: ({ children }: { children?: ReactNode }) => (
    <div data-testid="tool-content">{children}</div>
  ),
  ToolHeader: ({
    state,
    toolName,
    type,
  }: {
    state?: string;
    toolName?: string;
    type?: string;
  }) => (
    <button data-state={state} data-tool-name={toolName} type="button">
      {type}
    </button>
  ),
  ToolInput: ({ input }: { input?: unknown }) => (
    <div data-testid="tool-input">{JSON.stringify(input)}</div>
  ),
  ToolOutput: ({
    errorText,
    output,
  }: {
    errorText?: string;
    output?: unknown;
  }) => (
    <div data-testid="tool-output">{errorText ?? JSON.stringify(output)}</div>
  ),
}));

vi.mock("@repo/ui/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock("~/chat/message-copy-button", () => ({
  extractMessageText: (message: {
    parts: Array<{ text?: string; type: string }>;
  }) =>
    message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n\n")
      .trim(),
  MessageCopyButton: ({ text }: { text: string }) => (
    <button aria-label="Copy" type="button">
      {text}
    </button>
  ),
}));

const { ChatMessage } = await import("~/chat/chat-message");

afterEach(() => {
  cleanup();
});

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

describe("ChatMessage", () => {
  it("renders through ai-elements message primitives", () => {
    render(
      <ChatMessage
        isStreaming={false}
        message={{
          id: "msg_user",
          parts: [{ text: "Hello", type: "text" }],
          role: "user",
        }}
      />
    );

    expect(screen.getByTestId("message").getAttribute("data-from")).toBe(
      "user"
    );
    expect(screen.getByTestId("message-content").textContent).toContain(
      "Hello"
    );
    expect(screen.getByTestId("message-response").textContent).toBe("Hello");
    expect(screen.getByTestId("message-actions")).toBeTruthy();
  });

  it("leaves user bubble styling to the base message component", () => {
    render(
      <ChatMessage
        isStreaming={false}
        message={{
          id: "msg_user",
          parts: [{ text: "hey", type: "text" }],
          role: "user",
        }}
      />
    );

    const contentClassName = screen.getByTestId("message-content").className;
    expect(contentClassName).not.toContain("!rounded");
    expect(contentClassName).not.toContain("!bg-");
    expect(contentClassName).not.toContain("!px-");
    expect(contentClassName).not.toContain("!py-");
    expect(contentClassName).not.toContain("[&_p]:!");
  });

  it("leaves assistant text sizing to the base message component", () => {
    render(
      <ChatMessage
        isStreaming={false}
        message={{
          id: "msg_assistant",
          parts: [{ text: "Hello", type: "text" }],
          role: "assistant",
        }}
      />
    );

    const contentClassName = screen.getByTestId("message-content").className;
    expect(contentClassName).not.toContain("text-base");
  });

  it("does not re-render a completed message when the parent re-renders", () => {
    messageRenderCount = 0;
    messageResponseRenderCount = 0;
    const message = {
      id: "msg_assistant",
      parts: [{ text: "Stable answer", type: "text" as const }],
      role: "assistant" as const,
    };

    render(<Harness message={message} />);
    expect(messageRenderCount).toBe(1);
    expect(messageResponseRenderCount).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "force" }));
    fireEvent.click(screen.getByRole("button", { name: "force" }));

    expect(messageRenderCount).toBe(1);
    expect(messageResponseRenderCount).toBe(1);
  });

  it("renders reasoning and generic tool parts through chronological thinking steps", () => {
    render(
      <ChatMessage
        isStreaming={true}
        message={{
          id: "msg_assistant",
          parts: [
            { text: "Thinking", type: "reasoning" },
            {
              input: { query: "roadmap" },
              output: { count: 2 },
              state: "output-available",
              toolCallId: "tool_1",
              toolName: "searchDocs",
              type: "dynamic-tool",
            },
          ],
          role: "assistant",
        }}
      />
    );

    expect(screen.queryByTestId("reasoning")).toBeNull();
    expect(screen.getByTestId("thinking-steps")).toBeTruthy();
    expect(screen.getAllByTestId("thinking-step")[0]?.textContent).toContain(
      "Thinking"
    );
    expect(screen.getByTestId("tool").getAttribute("data-default-open")).toBe(
      "false"
    );
    expect(
      screen
        .getByRole("button", { name: "dynamic-tool" })
        .getAttribute("data-tool-name")
    ).toBe("searchDocs");
    expect(screen.getByTestId("tool-input").textContent).toContain("roadmap");
    expect(screen.getByTestId("tool-output").textContent).toContain("count");
  });

  it("renders thinking, tools, sources, and text in chronological order", () => {
    render(
      <ChatMessage
        isStreaming={true}
        message={{
          id: "msg_assistant",
          parts: [
            { text: "Checking context", type: "reasoning" },
            {
              data: {
                label: "Linear: searched issues",
                status: "completed",
                summary: "Found 4 issues",
              },
              type: "data-activity",
            },
            { text: "I found four issues.", type: "text" },
            {
              sourceId: "source_1",
              title: "LF-142",
              type: "source-url",
              url: "https://linear.app/LF-142",
            },
            { text: "The main blocker is LF-142.", type: "text" },
          ],
          role: "assistant",
        }}
      />
    );

    const content = screen.getByTestId("message-content").textContent ?? "";
    expect(content.indexOf("Thinking")).toBeLessThan(
      content.indexOf("I found four issues.")
    );
    expect(content.indexOf("Linear: searched issues")).toBeLessThan(
      content.indexOf("I found four issues.")
    );
    expect(content.indexOf("LF-142")).toBeGreaterThan(
      content.indexOf("I found four issues.")
    );
    expect(content.indexOf("LF-142")).toBeLessThan(
      content.indexOf("The main blocker is LF-142.")
    );
  });

  it("maps running and failed activity rows to ThinkingStep states", () => {
    render(
      <ChatMessage
        isStreaming={true}
        message={{
          id: "msg_assistant",
          parts: [
            {
              data: {
                label: "Searching Linear",
                status: "running",
              },
              type: "data-activity",
            },
            {
              data: {
                details: ["Linear returned 403"],
                label: "Updating Linear",
                status: "failed",
                summary: "Write failed",
              },
              type: "data-activity",
            },
          ],
          role: "assistant",
        }}
      />
    );

    const steps = screen.getAllByTestId("thinking-step");
    expect(steps[0]?.getAttribute("data-status")).toBe("active");
    expect(steps[1]?.getAttribute("data-status")).toBe("complete");
    expect(screen.getByText("Linear returned 403")).toBeTruthy();
  });

  it("collapses a streaming tool part when output becomes available", () => {
    const message = {
      id: "msg_assistant",
      parts: [
        {
          input: { query: "roadmap" },
          output: undefined,
          state: "input-available" as const,
          toolCallId: "tool_1",
          toolName: "searchDocs",
          type: "dynamic-tool" as const,
        },
      ],
      role: "assistant" as const,
    };
    const { rerender } = render(
      <ChatMessage isStreaming={true} message={message} />
    );

    expect(screen.getByTestId("tool").getAttribute("data-default-open")).toBe(
      "true"
    );

    rerender(
      <ChatMessage
        isStreaming={true}
        message={{
          ...message,
          parts: [
            {
              input: { query: "roadmap" },
              output: { count: 2 },
              state: "output-available" as const,
              toolCallId: "tool_1",
              toolName: "searchDocs",
              type: "dynamic-tool" as const,
            },
          ],
        }}
      />
    );

    expect(screen.getByTestId("tool").getAttribute("data-default-open")).toBe(
      "false"
    );
  });

  it("renders a quiet Granola usage indicator for user connector tool output", () => {
    render(
      <ChatMessage
        isStreaming={false}
        message={{
          id: "msg_1",
          role: "assistant",
          parts: [
            {
              input: {
                input: { query: "SOC2" },
                routineId: "granola__search_notes",
              },
              output: {
                provider: "granola",
                providerToolName: "search_notes",
                result: { content: [{ text: "result", type: "text" }] },
                routineId: "granola__search_notes",
                status: "succeeded",
              },
              state: "output-available",
              toolCallId: "tool_1",
              type: "tool-callUserConnectorTool",
            },
          ],
        }}
      />
    );

    expect(screen.getByText("Used Granola")).toBeTruthy();
    expect(screen.queryByTestId("tool")).toBeNull();
  });
});
