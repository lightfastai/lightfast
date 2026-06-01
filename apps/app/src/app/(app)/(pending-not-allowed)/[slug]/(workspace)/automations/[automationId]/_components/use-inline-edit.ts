import type { ChangeEvent, KeyboardEvent } from "react";
import { useRef, useState } from "react";

type EditableElement = HTMLInputElement | HTMLTextAreaElement;

interface UseInlineEditOptions {
  /** When true, the commit chord is Cmd/Ctrl+Enter and plain Enter inserts a newline. */
  multiline?: boolean;
  /** Called with the trimmed draft when a real change is committed. */
  onCommit: (next: string) => void;
  /** Current persisted value — source of truth for revert and change detection. */
  value: string;
}

export interface InlineEditFieldProps {
  autoFocus: boolean;
  onBlur: () => void;
  onChange: (event: ChangeEvent<EditableElement>) => void;
  onKeyDown: (event: KeyboardEvent<EditableElement>) => void;
  value: string;
}

export interface UseInlineEditResult {
  begin: () => void;
  draft: string;
  editing: boolean;
  fieldProps: InlineEditFieldProps;
}

export function useInlineEdit({
  value,
  multiline = false,
  onCommit,
}: UseInlineEditOptions): UseInlineEditResult {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // Set before any programmatic exit so the trailing blur (e.g. on unmount or
  // after Escape) does not commit a second time.
  const suppressBlur = useRef(false);

  function begin() {
    setDraft(value);
    suppressBlur.current = false;
    setEditing(true);
  }

  function commit() {
    suppressBlur.current = true;
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === value) {
      setDraft(value);
      return;
    }
    onCommit(trimmed);
  }

  function cancel() {
    suppressBlur.current = true;
    setDraft(value);
    setEditing(false);
  }

  function handleBlur() {
    if (suppressBlur.current) {
      suppressBlur.current = false;
      return;
    }
    commit();
  }

  function handleKeyDown(event: KeyboardEvent<EditableElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    const isCommitChord = multiline
      ? event.key === "Enter" && (event.metaKey || event.ctrlKey)
      : event.key === "Enter" && !event.shiftKey;
    if (isCommitChord) {
      event.preventDefault();
      commit();
    }
  }

  return {
    editing,
    draft,
    begin,
    fieldProps: {
      value: draft,
      onChange: (event) => setDraft(event.target.value),
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      autoFocus: true,
    },
  };
}
