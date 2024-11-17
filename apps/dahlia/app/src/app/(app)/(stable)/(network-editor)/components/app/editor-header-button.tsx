import React from "react";

import { Button, ButtonProps } from "@repo/ui/components/ui/button";

export const EditorHeaderButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(({ children, ...props }, ref) => {
  return (
    <Button
      variant="ghost"
      className="m-0 h-auto py-1.5 text-xs"
      ref={ref}
      {...props}
    >
      {children}
    </Button>
  );
});
