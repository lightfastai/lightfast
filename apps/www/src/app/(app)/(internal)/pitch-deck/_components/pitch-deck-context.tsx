"use client";

import * as React from "react";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";

const PREFACE_COOKIE_NAME = "pitch_deck_preface";
const PREFACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const PREFACE_KEYBOARD_SHORTCUT = "b";

interface PitchDeckContextProps {
  // Preface visibility state
  prefaceExpanded: boolean;
  setPrefaceExpanded: (expanded: boolean) => void;
  togglePreface: () => void;

  // View mode state
  isGridView: boolean;
  setIsGridView: (grid: boolean) => void;

  // Mobile detection
  isMobile: boolean;
}

const PitchDeckContext = React.createContext<PitchDeckContextProps | null>(null);

export function usePitchDeck() {
  const context = React.useContext(PitchDeckContext);
  if (!context) {
    throw new Error("usePitchDeck must be used within a PitchDeckProvider");
  }
  return context;
}

interface PitchDeckProviderProps {
  children: React.ReactNode;
  defaultPrefaceExpanded?: boolean;
}

export function PitchDeckProvider({
  children,
  defaultPrefaceExpanded = true,
}: PitchDeckProviderProps) {
  const isMobile = useIsMobile();

  // On mobile, default to collapsed. Otherwise use the provided default.
  const [prefaceExpanded, _setPrefaceExpanded] = React.useState(() => {
    // Initial state will be overridden by useEffect once we know if mobile
    return defaultPrefaceExpanded;
  });

  const [isGridView, setIsGridView] = React.useState(false);

  // Update preface state when mobile detection completes
  React.useEffect(() => {
    if (isMobile) {
      _setPrefaceExpanded(false);
    }
  }, [isMobile]);

  const setPrefaceExpanded = React.useCallback((expanded: boolean) => {
    _setPrefaceExpanded(expanded);
    // Persist to cookie
    document.cookie = `${PREFACE_COOKIE_NAME}=${expanded}; path=/; max-age=${PREFACE_COOKIE_MAX_AGE}`;
  }, []);

  const togglePreface = React.useCallback(() => {
    setPrefaceExpanded(!prefaceExpanded);
  }, [prefaceExpanded, setPrefaceExpanded]);

  // Keyboard shortcut: Cmd/Ctrl + B to toggle preface
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === PREFACE_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        togglePreface();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePreface]);

  const contextValue = React.useMemo<PitchDeckContextProps>(
    () => ({
      prefaceExpanded,
      setPrefaceExpanded,
      togglePreface,
      isGridView,
      setIsGridView,
      isMobile,
    }),
    [prefaceExpanded, setPrefaceExpanded, togglePreface, isGridView, isMobile]
  );

  return (
    <PitchDeckContext.Provider value={contextValue}>
      {children}
    </PitchDeckContext.Provider>
  );
}
