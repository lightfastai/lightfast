import { useEffect, useState } from "react";
import { setTheme } from "@/helpers/theme_helpers";
import { ThemeMode } from "@/types/theme-mode";
import { Monitor, Moon, Sun } from "lucide-react";

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";

const THEME_KEY = "theme";

export default function ToggleTheme() {
  // Initialize state from localStorage or default to 'system'
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem(THEME_KEY) as ThemeMode | null) ?? "system";
  });

  // Effect to apply the theme when the component mounts or state changes
  // Note: This duplicates logic in syncThemeWithLocal, consider refactoring
  // if theme is managed globally (e.g., context/store)
  useEffect(() => {
    setTheme(currentTheme);
  }, [currentTheme]);

  const handleThemeChange = (value: string) => {
    if (
      value &&
      (value === "system" || value === "light" || value === "dark")
    ) {
      const newTheme = value as ThemeMode;
      setCurrentTheme(newTheme);
      // No need to call setTheme here, useEffect handles it
    }
  };

  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={currentTheme}
      onValueChange={handleThemeChange}
      aria-label="Theme selection"
      className="border-border overflow-hidden rounded-full border"
    >
      <ToggleGroupItem
        size="xs"
        value="system"
        aria-label="System theme"
        className="border-border rounded-full"
      >
        <Monitor className="size-3" />
      </ToggleGroupItem>
      <ToggleGroupItem
        size="xs"
        value="light"
        aria-label="Light theme"
        className="border-border rounded-full"
      >
        <Sun className="size-3" />
      </ToggleGroupItem>
      <ToggleGroupItem
        size="xs"
        value="dark"
        aria-label="Dark theme"
        className="border-border rounded-full"
      >
        <Moon className="size-3" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
