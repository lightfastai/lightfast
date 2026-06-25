import { createMarkdownComponents } from "@repo/ui-v2/components/content/markdown";
import { cn } from "@repo/ui-v2/lib/utils";
import type { Route } from "next";
import Image, { type ImageProps } from "next/image";
import Link from "next/link";
import type { AnchorHTMLAttributes, ImgHTMLAttributes } from "react";

const parseImageDimension = (value: number | string | undefined) => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const baseMarkdownComponents = createMarkdownComponents({
  a({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
    const isExternal = href?.startsWith("http");
    const isInternalRoute = href?.startsWith("/") && !href.startsWith("//");

    if (href && isInternalRoute) {
      return (
        <Link
          className="wrap-anywhere relative text-foreground underline decoration-1 underline-offset-4 transition-colors duration-250 hover:text-muted-foreground"
          href={href as Route}
          {...props}
        >
          {children}
        </Link>
      );
    }

    return (
      <a
        className="wrap-anywhere relative text-foreground underline decoration-1 underline-offset-4 transition-colors duration-250 hover:text-muted-foreground"
        href={href}
        rel={isExternal ? "noopener noreferrer" : undefined}
        target={isExternal ? "_blank" : undefined}
        {...props}
      >
        {children}
      </a>
    );
  },
});

export const markdownComponents = {
  ...baseMarkdownComponents,
  img({
    alt = "",
    className,
    height,
    src,
    width,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement>) {
    const imageWidth = parseImageDimension(width);
    const imageHeight = parseImageDimension(height);

    if (!(typeof src === "string" && imageWidth && imageHeight)) {
      return (
        // biome-ignore lint/performance/noImgElement: MDX image fallbacks may not have dimensions for next/image.
        <img
          alt={alt}
          className={className}
          height={height}
          src={src}
          width={width}
          {...props}
        />
      );
    }

    return (
      <Image
        alt={alt}
        className={cn("h-auto", className)}
        height={imageHeight}
        src={src}
        width={imageWidth}
        {...(props as Omit<ImageProps, "alt" | "height" | "src" | "width">)}
      />
    );
  },
};
