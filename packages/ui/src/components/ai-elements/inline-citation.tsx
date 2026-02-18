"use client";

import { Button } from "../ui/button";
import {
	Carousel,
	
	CarouselContent,
	CarouselItem
} from "../ui/carousel";
import type {CarouselApi} from "../ui/carousel";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "../../lib/utils";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import {
	
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState
} from "react";
import type {ComponentProps} from "react";

export type InlineCitationProps = ComponentProps<"span">;

export const InlineCitation = ({
	className,
	...props
}: InlineCitationProps) => (
	<span
		className={cn("group inline items-center gap-1", className)}
		{...props}
	/>
);

export type InlineCitationTextProps = ComponentProps<"span">;

export const InlineCitationText = ({
	className,
	...props
}: InlineCitationTextProps) => (
	<span
		className={cn("transition-colors group-hover:bg-accent", className)}
		{...props}
	/>
);

export type InlineCitationCardProps = ComponentProps<typeof Popover>;

export const InlineCitationCard = (props: InlineCitationCardProps) => (
	<Popover {...props} />
);

export type InlineCitationCardTriggerProps = ComponentProps<typeof Button> & {
	sources: string[];
};

export const InlineCitationCardTrigger = ({
	sources,
	className,
	...props
}: InlineCitationCardTriggerProps) => {
	// Get unique domains and their favicons (max 3)
	const uniqueDomains = Array.from(
		new Set(
			sources.map((url) => {
				try {
					return new URL(url).hostname;
				} catch {
					return "unknown";
				}
			}),
		),
	).slice(0, 3);

	return (
		<PopoverTrigger asChild>
			<Button
				variant="secondary"
				size="sm"
				className={cn(
					"rounded-full flex items-center gap-1.5 px-2 text-xs",
					className,
				)}
				{...props}
			>
				{uniqueDomains.length > 0 ? (
					<>
						<div className="flex -space-x-1">
							{uniqueDomains.map((domain, index) => (
								<img
									key={domain}
									src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
									alt={domain}
									className="w-4 h-4 rounded-sm bg-white border border-border/20"
									style={{ zIndex: uniqueDomains.length - index }}
									onError={(e) => {
										const target = e.target as HTMLImageElement;
										target.src =
											"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04IDRDNS43OTA4NiA0IDQgNS43OTA4NiA0IDhDNCA5LjIwNTEgNC40NzQxIDEwLjI5MjIgNS4yMTc2MiAxMS4wNzgxTDEwLjkyMTYgNS4zNzQwN0MxMC4yMDc2IDQuNjI5ODggOS4xMjU0NCA0IDggNFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHBhdGggZD0iTTEwLjc4MjQgNS4wNzgxMkw1LjA3ODQzIDEwLjc4MjFDNS44NjI0MiAxMS41MjU5IDYuOTA3NTUgMTIgOCAxMkMxMC4yMDkxIDEyIDEyIDEwLjIwOTEgMTIgOEMxMiA2LjkwNzU1IDExLjUyNTkgNS44NjI0MiAxMC43ODI0IDUuMDc4MTJaIiBmaWxsPSIjNkI3Mjg4Ci8+Cjwvc3ZnPgo=";
									}}
								/>
							))}
						</div>
						<span className="font-medium">Sources</span>
					</>
				) : (
					<span>Sources</span>
				)}
			</Button>
		</PopoverTrigger>
	);
};

export type InlineCitationCardBodyProps = ComponentProps<"div">;

export const InlineCitationCardBody = ({
	className,
	...props
}: InlineCitationCardBodyProps) => (
	<PopoverContent
		className={cn("w-80 p-0", className)}
		align="start"
		sideOffset={8}
		{...props}
	/>
);

const CarouselApiContext = createContext<CarouselApi | undefined>(undefined);

const useCarouselApi = () => {
	const context = useContext(CarouselApiContext);
	return context;
};

export type InlineCitationCarouselProps = ComponentProps<typeof Carousel>;

export const InlineCitationCarousel = ({
	className,
	children,
	...props
}: InlineCitationCarouselProps) => {
	const [api, setApi] = useState<CarouselApi>();

	return (
		<CarouselApiContext.Provider value={api}>
			<Carousel className={cn("w-full", className)} setApi={setApi} {...props}>
				{children}
			</Carousel>
		</CarouselApiContext.Provider>
	);
};

export type InlineCitationCarouselContentProps = ComponentProps<"div">;

export const InlineCitationCarouselContent = (
	props: InlineCitationCarouselContentProps,
) => <CarouselContent {...props} />;

export type InlineCitationCarouselItemProps = ComponentProps<"div">;

export const InlineCitationCarouselItem = ({
	className,
	...props
}: InlineCitationCarouselItemProps) => (
	<CarouselItem
		className={cn("w-full space-y-2 p-4 pl-8", className)}
		{...props}
	/>
);

export type InlineCitationCarouselHeaderProps = ComponentProps<"div">;

export const InlineCitationCarouselHeader = ({
	className,
	...props
}: InlineCitationCarouselHeaderProps) => (
	<div
		className={cn(
			"flex items-center justify-between gap-2 rounded-t-md bg-secondary p-2",
			className,
		)}
		{...props}
	/>
);

export type InlineCitationCarouselIndexProps = ComponentProps<"div">;

export const InlineCitationCarouselIndex = ({
	children,
	className,
	...props
}: InlineCitationCarouselIndexProps) => {
	const api = useCarouselApi();
	const [current, setCurrent] = useState(0);
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (!api) {
			return;
		}

		const updateState = () => {
			setCount(api.scrollSnapList().length);
			setCurrent(api.selectedScrollSnap() + 1);
		};

		api.on("reInit", updateState);
		api.on("select", updateState);

		// Schedule initial sync
		requestAnimationFrame(updateState);

		return () => {
			api.off("reInit", updateState);
			api.off("select", updateState);
		};
	}, [api]);

	return (
		<div
			className={cn(
				"flex flex-1 items-center justify-end px-3 py-1 text-muted-foreground text-xs",
				className,
			)}
			{...props}
		>
			{children ?? `${current}/${count}`}
		</div>
	);
};

export type InlineCitationCarouselPrevProps = ComponentProps<"button">;

export const InlineCitationCarouselPrev = ({
	className,
	...props
}: InlineCitationCarouselPrevProps) => {
	const api = useCarouselApi();

	const handleClick = useCallback(() => {
		if (api) {
			api.scrollPrev();
		}
	}, [api]);

	return (
		<button
			aria-label="Previous"
			className={cn("shrink-0", className)}
			onClick={handleClick}
			type="button"
			{...props}
		>
			<ArrowLeftIcon className="size-4 text-muted-foreground" />
		</button>
	);
};

export type InlineCitationCarouselNextProps = ComponentProps<"button">;

export const InlineCitationCarouselNext = ({
	className,
	...props
}: InlineCitationCarouselNextProps) => {
	const api = useCarouselApi();

	const handleClick = useCallback(() => {
		if (api) {
			api.scrollNext();
		}
	}, [api]);

	return (
		<button
			aria-label="Next"
			className={cn("shrink-0", className)}
			onClick={handleClick}
			type="button"
			{...props}
		>
			<ArrowRightIcon className="size-4 text-muted-foreground" />
		</button>
	);
};

export type InlineCitationSourceProps = ComponentProps<"div"> & {
	title?: string;
	url?: string;
	description?: string;
};

export const InlineCitationSource = ({
	title,
	url,
	description,
	className,
	children,
	...props
}: InlineCitationSourceProps) => (
	<div className={cn("space-y-1", className)} {...props}>
		{title && (
			<h4 className="truncate font-medium text-sm leading-tight">{title}</h4>
		)}
		{url && (
			<p className="truncate break-all text-muted-foreground text-xs">{url}</p>
		)}
		{description && (
			<p className="line-clamp-3 text-muted-foreground text-sm leading-relaxed">
				{description}
			</p>
		)}
		{children}
	</div>
);

export type InlineCitationQuoteProps = ComponentProps<"blockquote">;

export const InlineCitationQuote = ({
	children,
	className,
	...props
}: InlineCitationQuoteProps) => (
	<blockquote
		className={cn(
			"border-muted border-l-2 pl-3 text-muted-foreground text-sm italic",
			className,
		)}
		{...props}
	>
		{children}
	</blockquote>
);

