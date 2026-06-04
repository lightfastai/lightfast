import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./conversation";

const stickToBottomMock = vi.hoisted(() => ({
  scrollToBottom: vi.fn(),
  state: {
    isAtBottom: true,
  },
}));

vi.mock("use-stick-to-bottom", async () => {
  const React = await import("react");

  type StickToBottomProps = React.ComponentProps<"div"> & {
    initial?: string;
    resize?: string;
  };

  const StickToBottom = ({
    children,
    className,
    initial,
    resize,
    ...props
  }: StickToBottomProps) => (
    <div
      className={className}
      data-initial={initial}
      data-resize={resize}
      {...props}
    >
      {children}
    </div>
  );

  StickToBottom.Content = ({
    children,
    className,
    ...props
  }: React.ComponentProps<"div">) => (
    <div className={className} {...props}>
      {children}
    </div>
  );

  return {
    StickToBottom,
    useStickToBottomContext: () => ({
      isAtBottom: stickToBottomMock.state.isAtBottom,
      scrollToBottom: stickToBottomMock.scrollToBottom,
    }),
  };
});

beforeEach(() => {
  stickToBottomMock.state.isAtBottom = true;
  stickToBottomMock.scrollToBottom.mockClear();
});

describe("Conversation scroll button", () => {
  it("hides at bottom and scrolls to the latest message when shown", () => {
    const { rerender } = render(
      <Conversation>
        <ConversationContent>
          <div style={{ height: 2000 }}>messages</div>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    );

    expect(
      screen.queryByRole("button", { name: "Scroll to latest message" })
    ).toBeNull();

    stickToBottomMock.state.isAtBottom = false;
    rerender(
      <Conversation>
        <ConversationContent>
          <div style={{ height: 2000 }}>messages</div>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Scroll to latest message" })
    );

    expect(stickToBottomMock.scrollToBottom).toHaveBeenCalledTimes(1);
  });
});

describe("ConversationContent", () => {
  it("renders every child so native scrolling can stay attached to the message DOM", () => {
    const items = Array.from({ length: 50 }, (_, i) => `Message ${i + 1}`);
    render(
      <Conversation>
        <ConversationContent>
          {items.map((item) => (
            <div key={item}>{item}</div>
          ))}
        </ConversationContent>
      </Conversation>
    );

    expect(screen.queryByText("Message 1")).not.toBeNull();
    expect(screen.queryByText("Message 40")).not.toBeNull();
  });
});
