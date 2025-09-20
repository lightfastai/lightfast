import { forwardRef } from "react";
import type { ReactNode } from "react";
import { Text, TouchableOpacity } from "react-native";
import type { TextProps, TouchableOpacityProps } from "react-native";

type ClassValue = string | null | undefined | false;

function cn(...classes: ClassValue[]) {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "inverse"
  | "destructive";

type ButtonSize = "default" | "sm" | "icon";

const BASE_CLASS = "flex-row items-center justify-center gap-2 rounded-md px-4 font-medium";
const DISABLED_CLASS = "opacity-50";
const FULL_WIDTH_CLASS = "w-full";

const VARIANT_CLASSNAMES: Record<ButtonVariant, string> = {
  default: "bg-primary",
  secondary: "bg-secondary",
  outline: "border border-border bg-background",
  ghost: "bg-transparent",
  inverse: "bg-foreground",
  destructive: "bg-destructive",
};

const SIZE_CLASSNAMES: Record<ButtonSize, string> = {
  default: "h-12",
  sm: "h-10",
  icon: "h-12 w-12 rounded-full px-0",
};

const TEXT_VARIANT_CLASSNAMES: Record<ButtonVariant, string> = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  outline: "text-foreground",
  ghost: "text-foreground",
  inverse: "text-background",
  destructive: "text-destructive-foreground",
};

const TEXT_SIZE_CLASSNAMES: Record<ButtonSize, string> = {
  default: "text-sm",
  sm: "text-xs",
  icon: "text-sm",
};

interface BaseButtonProps extends TouchableOpacityProps {
  className?: string;
  children?: ReactNode;
}

export interface ButtonProps extends BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const ButtonBase = forwardRef<TouchableOpacity, ButtonProps>(
  (
    {
      variant = "default",
      size = "default",
      fullWidth = true,
      className,
      disabled,
      activeOpacity,
      ...rest
    },
    ref,
  ) => (
    <TouchableOpacity
      ref={ref}
      className={cn(
        BASE_CLASS,
        SIZE_CLASSNAMES[size],
        VARIANT_CLASSNAMES[variant],
        fullWidth ? FULL_WIDTH_CLASS : null,
        disabled ? DISABLED_CLASS : null,
        className,
      )}
      disabled={disabled}
      activeOpacity={activeOpacity ?? 0.85}
      {...rest}
    />
  ),
);

ButtonBase.displayName = "Button";

export interface ButtonTextProps extends TextProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

const ButtonText = ({
  variant = "default",
  size = "default",
  className,
  ...props
}: ButtonTextProps) => (
  <Text
    className={cn(
      "text-center",
      TEXT_VARIANT_CLASSNAMES[variant],
      TEXT_SIZE_CLASSNAMES[size],
      className,
    )}
    {...props}
  />
);

export const Button = Object.assign(ButtonBase, {
  Text: ButtonText,
});

export { ButtonText };
export type { ButtonSize, ButtonVariant };
