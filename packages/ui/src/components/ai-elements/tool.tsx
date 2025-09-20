"use client";

import { cn } from "../../lib/utils";
import type { HTMLAttributes } from "react";

export type ToolProps = HTMLAttributes<HTMLDivElement>;

export const Tool = ({ className, ...props }: ToolProps) => (
	<div
		className={cn(
			"flex w-full flex-col overflow-hidden rounded-lg border bg-background text-sm shadow-sm",
			className,
		)}
		{...props}
	/>
);

export type ToolHeaderProps = HTMLAttributes<HTMLDivElement>;

export const ToolHeader = ({ className, ...props }: ToolHeaderProps) => (
	<div
		className={cn("flex items-center gap-3 px-4 py-3", className)}
		{...props}
	/>
);

export type ToolIconProps = HTMLAttributes<HTMLSpanElement>;

export const ToolIcon = ({ className, ...props }: ToolIconProps) => (
	<span
		className={cn(
			"grid h-6 w-6 place-items-center text-muted-foreground [&>svg]:h-4 [&>svg]:w-4",
			className,
		)}
		{...props}
	/>
);

export type ToolHeaderMainProps = HTMLAttributes<HTMLDivElement>;

export const ToolHeaderMain = ({
	className,
	...props
}: ToolHeaderMainProps) => (
	<div
		className={cn("flex min-w-0 flex-1 flex-col gap-1", className)}
		{...props}
	/>
);

export type ToolTitleProps = HTMLAttributes<HTMLParagraphElement>;

export const ToolTitle = ({ className, ...props }: ToolTitleProps) => (
	<p className={cn("truncate text-xs font-medium text-foreground", className)} {...props} />
);

export type ToolDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export const ToolDescription = ({
	className,
	...props
}: ToolDescriptionProps) => (
	<p
		className={cn("truncate text-xs text-muted-foreground", className)}
		{...props}
	/>
);

export type ToolMetaProps = HTMLAttributes<HTMLDivElement>;

export const ToolMeta = ({ className, ...props }: ToolMetaProps) => (
	<div className={cn("flex shrink-0 items-center gap-2 text-xs text-muted-foreground", className)} {...props} />
);

export type ToolContentProps = HTMLAttributes<HTMLDivElement>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
	<div
		className={cn(
			"border-t bg-muted/30 px-4 py-3 text-xs text-muted-foreground",
			className,
		)}
		{...props}
	/>
);

export type ToolFooterProps = HTMLAttributes<HTMLDivElement>;

export const ToolFooter = ({ className, ...props }: ToolFooterProps) => (
	<div
		className={cn("border-t bg-background px-4 py-3", className)}
		{...props}
	/>
);
