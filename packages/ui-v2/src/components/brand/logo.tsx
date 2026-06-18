import { cn } from "@repo/ui-v2/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

const DOT_MATRIX_PATH =
  "M8 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M8 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M8 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 76a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 4a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M80 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 76a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 4a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 76a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 4a4 4 0 1 0-8 0 4 4 0 0 0 8 0M80 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M80 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0";

const logoVariants = cva("inline-flex shrink-0 items-center", {
  variants: {
    size: {
      xs: "gap-[5px] [--logo-mark-size:16px] [--logo-wordmark-line-height:20px] [--logo-wordmark-size:17px]",
      sm: "gap-1.5 [--logo-mark-size:22px] [--logo-wordmark-line-height:28px] [--logo-wordmark-size:23px]",
      md: "gap-[8.75px] [--logo-mark-size:31.3px] [--logo-wordmark-line-height:40px] [--logo-wordmark-size:33.45px]",
      lg: "gap-[11px] [--logo-mark-size:40px] [--logo-wordmark-line-height:48px] [--logo-wordmark-size:42px]",
      xl: "gap-3.5 [--logo-mark-size:56px] [--logo-wordmark-line-height:64px] [--logo-wordmark-size:58px]",
    },
    variant: {
      default: "text-foreground",
      inverse: "text-white",
      muted: "text-muted-foreground",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "default",
  },
});

export interface LogoProps
  extends ComponentPropsWithoutRef<"div">,
    VariantProps<typeof logoVariants> {
  showWordmark?: boolean;
}

function Logo({
  className,
  showWordmark = true,
  size = "md",
  style,
  variant = "default",
  ...props
}: LogoProps) {
  const rootProps = showWordmark
    ? props
    : {
        role: "img",
        "aria-label": "Lightfast",
        ...props,
      };

  return (
    <div
      data-show-wordmark={showWordmark}
      data-size={size}
      data-slot="logo"
      data-variant={variant}
      {...rootProps}
      className={cn(logoVariants({ size, variant, className }))}
      style={style}
    >
      <svg
        aria-hidden="true"
        className="h-[var(--logo-mark-size)] w-[var(--logo-mark-size)] shrink-0 overflow-visible"
        data-slot="logo-mark"
        focusable="false"
        viewBox="0 0 80 80"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={DOT_MATRIX_PATH} fill="currentColor" />
      </svg>
      {showWordmark ? (
        <span
          className="font-medium font-wordmark font-wordmark-features text-[length:var(--logo-wordmark-size)] leading-[var(--logo-wordmark-line-height)] tracking-[-0.02em]"
          data-slot="logo-wordmark"
        >
          Lightfast
        </span>
      ) : null}
    </div>
  );
}

export { Logo, logoVariants };
