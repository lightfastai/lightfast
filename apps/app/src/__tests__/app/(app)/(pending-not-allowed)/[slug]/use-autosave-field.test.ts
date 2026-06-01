import { act, renderHook } from "@testing-library/react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { useAutosaveField } from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/use-autosave-field";

function changeEvent(value: string) {
  return { target: { value } } as unknown as ChangeEvent<HTMLInputElement>;
}

function keyEvent(
  over: Partial<{
    key: string;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
  }>
) {
  return {
    key: "",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    currentTarget: { blur: vi.fn() },
    ...over,
  } as unknown as KeyboardEvent<HTMLInputElement>;
}

describe("useAutosaveField", () => {
  it("seeds the draft from the persisted value", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useAutosaveField({ value: "Hello", onCommit })
    );

    expect(result.current.draft).toBe("Hello");
    expect(result.current.fieldProps.value).toBe("Hello");
  });

  it("commits the trimmed draft on blur", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useAutosaveField({ value: "Hello", onCommit })
    );

    act(() => result.current.fieldProps.onFocus());
    act(() => result.current.fieldProps.onChange(changeEvent("  World  ")));
    act(() => result.current.fieldProps.onBlur());

    expect(onCommit).toHaveBeenCalledWith("World");
  });

  it("does not commit when the trimmed draft is unchanged", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useAutosaveField({ value: "Hello", onCommit })
    );

    act(() => result.current.fieldProps.onFocus());
    act(() => result.current.fieldProps.onChange(changeEvent("  Hello  ")));
    act(() => result.current.fieldProps.onBlur());

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not commit when the draft is empty", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useAutosaveField({ value: "Hello", onCommit })
    );

    act(() => result.current.fieldProps.onFocus());
    act(() => result.current.fieldProps.onChange(changeEvent("   ")));
    act(() => result.current.fieldProps.onBlur());

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits on Enter when single-line", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useAutosaveField({ value: "Hello", onCommit })
    );

    act(() => result.current.fieldProps.onFocus());
    act(() => result.current.fieldProps.onChange(changeEvent("Renamed")));
    act(() => result.current.fieldProps.onKeyDown(keyEvent({ key: "Enter" })));

    expect(onCommit).toHaveBeenCalledWith("Renamed");
  });

  it("commits only on Cmd/Ctrl+Enter when multiline", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useAutosaveField({ value: "Hello", multiline: true, onCommit })
    );

    act(() => result.current.fieldProps.onFocus());
    act(() => result.current.fieldProps.onChange(changeEvent("New body")));
    act(() => result.current.fieldProps.onKeyDown(keyEvent({ key: "Enter" })));
    expect(onCommit).not.toHaveBeenCalled();

    act(() =>
      result.current.fieldProps.onKeyDown(
        keyEvent({ key: "Enter", metaKey: true })
      )
    );
    expect(onCommit).toHaveBeenCalledWith("New body");
  });

  it("reverts on Escape without committing", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useAutosaveField({ value: "Hello", onCommit })
    );

    act(() => result.current.fieldProps.onFocus());
    act(() => result.current.fieldProps.onChange(changeEvent("Discard me")));
    act(() => result.current.fieldProps.onKeyDown(keyEvent({ key: "Escape" })));

    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.draft).toBe("Hello");
  });

  it("suppresses the trailing blur after Escape (no double-handle)", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useAutosaveField({ value: "Hello", onCommit })
    );

    act(() => result.current.fieldProps.onFocus());
    act(() => result.current.fieldProps.onChange(changeEvent("Changed")));
    act(() => result.current.fieldProps.onKeyDown(keyEvent({ key: "Escape" })));
    act(() => result.current.fieldProps.onBlur());

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("syncs the draft from a new persisted value while unfocused", () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) => useAutosaveField({ value, onCommit }),
      { initialProps: { value: "Hello" } }
    );

    rerender({ value: "Server changed" });
    expect(result.current.draft).toBe("Server changed");
  });

  it("does not clobber an in-progress edit when the value changes", () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) => useAutosaveField({ value, onCommit }),
      { initialProps: { value: "Hello" } }
    );

    act(() => result.current.fieldProps.onFocus());
    act(() => result.current.fieldProps.onChange(changeEvent("Typing…")));
    rerender({ value: "Server changed" });

    expect(result.current.draft).toBe("Typing…");
  });
});
