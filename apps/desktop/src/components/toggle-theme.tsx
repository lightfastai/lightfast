import { toggleTheme } from "@/helpers/theme_helpers";
import { Moon } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";

export default function ToggleTheme() {
  return (
    <Button onClick={toggleTheme} size="icon">
      <Moon size={16} />
    </Button>
  );
}
