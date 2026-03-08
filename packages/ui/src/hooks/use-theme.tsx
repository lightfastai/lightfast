"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "../components/ui/button";
import { useMounted } from "./use-mounted";

export const ThemeChanger = () => {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return <Button variant="ghost" />;
  }

  return (
    <Button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      variant="ghost"
    >
      {theme === "dark" ? <Moon /> : <Sun />}
    </Button>
  );
};
