import type React from "react";
import { Icons } from "./icons";

export const ErrorCode = {
  BadRequest: "400",
  Unauthorized: "401",
  Forbidden: "403",
  NotFound: "404",
  MethodNotAllowed: "405",
  TooManyRequests: "429",
  InternalServerError: "500",
  BadGateway: "502",
  ServiceUnavailable: "503",
  GatewayTimeout: "504",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

interface LightfastErrorPageProps {
  /**
   * Custom actions (buttons, links, etc.)
   */
  children?: React.ReactNode;
  /**
   * The error code to display
   */
  code: ErrorCode;

  /**
   * The error description/message
   */
  description: string;

  /**
   * Optional error ID or digest to display
   */
  errorId?: string;
}

export function LightfastErrorPage({
  code,
  description,
  errorId,
  children,
}: LightfastErrorPageProps) {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="flex flex-col items-center">
        {/* Lightfast logo */}
        <div className="mb-8">
          <Icons.logoShort className="h-8 w-10 text-white" />
        </div>

        {/* Large error code heading */}
        <h1 className="mb-4 font-bold text-8xl tracking-tighter">{code}</h1>

        {/* Error description */}
        <p className="mb-8 text-md text-muted-foreground">{description}</p>

        {/* Error ID if available */}
        {errorId && (
          <p className="mb-8 text-muted-foreground/60 text-sm">
            Error ID: {errorId}
          </p>
        )}

        {/* Custom actions */}
        {children && <div className="flex flex-row gap-4">{children}</div>}
      </div>
    </div>
  );
}
