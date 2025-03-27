import React from "react";

import type { ButtonProps } from "@repo/ui/components/ui/button";
import { Button } from "@repo/ui/components/ui/button";

export const EditorHeaderButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(({ children, ...props }, ref) => {
  return (
    <Button
      variant="ghost"
      className="m-0 h-auto rounded-none text-xs"
      ref={ref}
      {...props}
    >
      {children}
    </Button>
  );
});
