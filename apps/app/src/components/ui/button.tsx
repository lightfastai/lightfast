// custom button variant called xs and ingeriting from button component, cva

import type { VariantProps } from "class-variance-authority";

import type { buttonVariants } from "@repo/ui/components/ui/button";
import { Button } from "@repo/ui/components/ui/button";

export const WorkspaceIconButton = ({
  children,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) => {
  return (
    <Button {...props} className="h-7 px-2 py-1 has-[>svg]:px-2">
      {children}
    </Button>
  );
};
