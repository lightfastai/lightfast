import React from "react";
import { Icons } from "./icons";

export enum ErrorCode {
	BadRequest = "400",
	Unauthorized = "401",
	Forbidden = "403",
	NotFound = "404",
	MethodNotAllowed = "405",
	TooManyRequests = "429",
	InternalServerError = "500",
	BadGateway = "502",
	ServiceUnavailable = "503",
	GatewayTimeout = "504",
}

interface LightfastErrorPageProps {
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

	/**
	 * Custom actions (buttons, links, etc.)
	 */
	children?: React.ReactNode;
}

export function LightfastErrorPage({
	code,
	description,
	errorId,
	children,
}: LightfastErrorPageProps) {
	return (
		<div className="h-full flex items-center justify-center p-4">
			<div className="flex flex-col items-center">
				{/* Lightfast logo */}
				<div className="mb-8">
					<Icons.logoShort className="w-10 h-8 text-white" />
				</div>

				{/* Large error code heading */}
				<h1 className="text-8xl font-bold tracking-tighter mb-4">{code}</h1>

				{/* Error description */}
				<p className="text-muted-foreground text-md mb-8">{description}</p>

				{/* Error ID if available */}
				{errorId && (
					<p className="text-muted-foreground/60 text-sm mb-8">
						Error ID: {errorId}
					</p>
				)}

				{/* Custom actions */}
				{children && <div className="flex flex-row gap-4">{children}</div>}
			</div>
		</div>
	);
}