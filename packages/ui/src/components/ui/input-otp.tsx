"use client";

import { cn } from "@repo/ui/lib/utils";
import { cva } from "class-variance-authority";
import type { OTPInputProps } from "input-otp";
import { OTPInput, OTPInputContext } from "input-otp";
import { MinusIcon } from "lucide-react";
import * as React from "react";

// Create context for size
const InputOTPSizeContext = React.createContext<"default" | "lg">("default");

const inputOTPSlotVariants = cva(
  "relative flex items-center justify-center border-input border-y border-r text-sm shadow-xs outline-none transition-all first:rounded-l-md first:border-l last:rounded-r-md aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:data-[active=true]:aria-invalid:ring-destructive/40",
  {
    variants: {
      size: {
        default: "h-9 w-9",
        lg: "h-10 w-10",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

function InputOTP({
  className,
  containerClassName,
  size = "default",
  ...props
}: Omit<OTPInputProps, "size"> & {
  containerClassName?: string;
  size?: "default" | "lg";
}) {
  return (
    <InputOTPSizeContext.Provider value={size}>
      <OTPInput
        className={cn("disabled:cursor-not-allowed", className)}
        containerClassName={cn(
          "flex items-center gap-2 has-disabled:opacity-50",
          containerClassName
        )}
        data-slot="input-otp"
        {...(props as OTPInputProps)}
      />
    </InputOTPSizeContext.Provider>
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center", className)}
      data-slot="input-otp-group"
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number;
}) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const size = React.useContext(InputOTPSizeContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index] ?? {};

  return (
    <div
      className={cn(inputOTPSlotVariants({ size }), className)}
      data-active={isActive}
      data-slot="input-otp-slot"
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <>
      {/* biome-ignore lint/a11y/useAriaPropsForRole: OTP separator is non-focusable visual element, aria-valuenow not required for non-focusable separators */}
      {/* biome-ignore lint/a11y/useFocusableInteractive: OTP separator is a visual-only element, making it focusable would be incorrect UX */}
      <div data-slot="input-otp-separator" role="separator" {...props}>
        <MinusIcon />
      </div>
    </>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
