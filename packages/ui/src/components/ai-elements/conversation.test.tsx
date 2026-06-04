import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./conversation";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    getItemKey,
  }: {
    count: number;
    getItemKey: (index: number) => string | number;
  }) => {
    const windowSize = Math.min(count, 5);
    return {
      getTotalSize: () => count * 80,
      getVirtualItems: () =>
        Array.from({ length: windowSize }, (_, index) => ({
          index,
          key: getItemKey(index),
          start: index * 80,
          size: 80,
        })),
      measureElement: () => undefined,
    };
  },
}));

function setGeometry(
  el: HTMLElement,
  geo: { scrollTop: number; scrollHeight: number; clientHeight: number }
) {
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    value: geo.scrollHeight,
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    value: geo.clientHeight,
  });
  el.scrollTop = geo.scrollTop;
}

describe("Conversation scroll button", () => {
  it("hides at bottom and shows after scrolling up", () => {
    const { container } = render(
      <Conversation>
        <ConversationContent
          getItemKey={(item) => item}
          items={["messages"]}
          renderItem={(item) => <div style={{ height: 2000 }}>{item}</div>}
        />
        <ConversationScrollButton />
      </Conversation>
    );

    const scroller = container.querySelector(
      "[data-slot=conversation-scroller]"
    ) as HTMLElement;
    expect(scroller).not.toBeNull();

    // At bottom: scrollTop + clientHeight === scrollHeight → button hidden.
    setGeometry(scroller, {
      scrollTop: 1500,
      scrollHeight: 2000,
      clientHeight: 500,
    });
    fireEvent.scroll(scroller);
    expect(
      screen.queryByRole("button", { name: "Scroll to latest message" })
    ).toBeNull();

    // Scrolled up: gap > threshold → button shows.
    setGeometry(scroller, {
      scrollTop: 0,
      scrollHeight: 2000,
      clientHeight: 500,
    });
    fireEvent.scroll(scroller);
    expect(
      screen.queryByRole("button", { name: "Scroll to latest message" })
    ).not.toBeNull();
  });

  it("scrolls to the bottom when messages append while the user is already at the bottom", () => {
    const { container, rerender } = render(
      <Conversation>
        <ConversationContent
          getItemKey={(item) => item}
          items={["Message 1"]}
          renderItem={(item) => <div>{item}</div>}
        />
        <ConversationScrollButton />
      </Conversation>
    );

    const scroller = container.querySelector(
      "[data-slot=conversation-scroller]"
    ) as HTMLElement;
    const scrollTo = vi.fn();
    Object.defineProperty(scroller, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    setGeometry(scroller, {
      scrollTop: 1500,
      scrollHeight: 2000,
      clientHeight: 500,
    });

    rerender(
      <Conversation>
        <ConversationContent
          getItemKey={(item) => item}
          items={["Message 1", "Message 2"]}
          renderItem={(item) => <div>{item}</div>}
        />
        <ConversationScrollButton />
      </Conversation>
    );

    expect(scrollTo).toHaveBeenCalledWith({ top: 2000 });
  });
});

describe("ConversationContent virtualization", () => {
  it("renders only the windowed items", () => {
    const items = Array.from({ length: 50 }, (_, i) => `Message ${i + 1}`);
    render(
      <Conversation>
        <ConversationContent
          getItemKey={(item) => item}
          items={items}
          renderItem={(item) => <div>{item}</div>}
        />
      </Conversation>
    );

    expect(screen.queryByText("Message 1")).not.toBeNull();
    expect(screen.queryByText("Message 40")).toBeNull();
  });
});
