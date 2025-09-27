import { forwardRef } from "react";
import { TextInput } from "react-native";
import type { TextInputProps } from "react-native";

type ClassValue = string | null | undefined | false;

function cn(...classes: ClassValue[]) {
  return classes.filter(Boolean).join(" ");
}

const BASE_CLASS =
  "w-full rounded-md border border-input bg-background px-4 py-3 text-base text-foreground";
const SIZE_CLASSNAMES = {
  default: "h-12",
  sm: "h-10 text-sm",
} as const;

export interface InputProps extends TextInputProps {
  className?: string;
  size?: keyof typeof SIZE_CLASSNAMES;
  invalid?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      className,
      size = "default",
      invalid = false,
      placeholderTextColor = "hsl(0 0% 60%)",
      ...rest
    },
    ref,
  ) => (
    <TextInput
      ref={ref}
      className={cn(
        BASE_CLASS,
        SIZE_CLASSNAMES[size],
        invalid ? "border-destructive" : null,
        className,
      )}
      placeholderTextColor={placeholderTextColor}
      {...rest}
    />
  ),
);

Input.displayName = "Input";
