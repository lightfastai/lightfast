import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./conversation";

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
        <ConversationContent>
          <div style={{ height: 2000 }}>messages</div>
        </ConversationContent>
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
});
