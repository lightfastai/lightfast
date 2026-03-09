"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface TeamSwitcherLinkProps {
  children: React.ReactNode;
  className?: string;
  href: string;
  /** Async callback invoked before navigation (e.g., set active org in auth SDK) */
  onNavigate?: () => Promise<void>;
  /** Sync callback invoked on click (e.g., close dropdown) */
  onClick?: () => void;
}

export function TeamSwitcherLink({
  children,
  className,
  href,
  onNavigate,
  onClick,
}: TeamSwitcherLinkProps) {
  const router = useRouter();

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
      return;
    }

    e.preventDefault();
    onClick?.();

    try {
      if (onNavigate) {
        await onNavigate();
      }
      router.push(href);
    } catch (error) {
      console.error("Failed to navigate:", error);
    }
  };

  return (
    <Link
      className={className}
      href={href}
      onClick={handleClick}
      prefetch={true}
    >
      {children}
    </Link>
  );
}
