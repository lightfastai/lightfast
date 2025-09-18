import { useEffect, useRef, useState } from "react";

interface UseTypewriterStreamOptions {
	speedMs?: number;
}

const DEFAULT_TYPEWRITER_SPEED_MS = 5;

/**
 * Provides a typewriter-style stream for incrementally received text.
 * When `animate` is false the hook simply returns the full text.
 */
export function useTypewriterStream(
	text: string,
	animate: boolean,
	options: UseTypewriterStreamOptions = {},
): string {
	const speedMs = options.speedMs ?? DEFAULT_TYPEWRITER_SPEED_MS;
	const [stream, setStream] = useState(text);
	const frameRef = useRef<ReturnType<typeof requestAnimationFrame>>();
	const lastTimeRef = useRef(0);
	const indexRef = useRef(text.length);
	const previousTextRef = useRef(text);
	const isAnimatingRef = useRef(false);

	// Cancel any pending animation frame on unmount.
	useEffect(() => {
		return () => {
			if (frameRef.current !== undefined) {
				cancelAnimationFrame(frameRef.current);
				frameRef.current = undefined;
			}
			isAnimatingRef.current = false;
		};
	}, []);

	useEffect(() => {
		const previousText = previousTextRef.current;
		previousTextRef.current = text;

		if (!animate) {
			if (frameRef.current !== undefined) {
				cancelAnimationFrame(frameRef.current);
				frameRef.current = undefined;
			}
			isAnimatingRef.current = false;
			indexRef.current = text.length;
			lastTimeRef.current = 0;
			setStream(text);
			return;
		}

		if (text.length === 0) {
			if (frameRef.current !== undefined) {
				cancelAnimationFrame(frameRef.current);
				frameRef.current = undefined;
			}
			isAnimatingRef.current = false;
			indexRef.current = 0;
			lastTimeRef.current = 0;
			setStream("");
			return;
		}

		// Nothing new to animate.
		if (text === previousText && indexRef.current >= text.length) {
			return;
		}

		// Handle cases where the backend rewound the stream.
		if (text.length < indexRef.current) {
			indexRef.current = 0;
			setStream("");
		}

		const animateFrame = (timestamp: number) => {
			if (!lastTimeRef.current) {
				lastTimeRef.current = timestamp;
			}

			if (timestamp - lastTimeRef.current >= speedMs) {
				indexRef.current = Math.min(indexRef.current + 1, text.length);
				setStream(text.slice(0, indexRef.current));
				lastTimeRef.current = timestamp;
			}

			if (indexRef.current < text.length) {
				frameRef.current = requestAnimationFrame(animateFrame);
			} else {
				isAnimatingRef.current = false;
			}
		};

		if (!isAnimatingRef.current) {
			isAnimatingRef.current = true;
			lastTimeRef.current = 0;
			frameRef.current = requestAnimationFrame(animateFrame);
		}

		return () => {
			if (frameRef.current !== undefined) {
				cancelAnimationFrame(frameRef.current);
				frameRef.current = undefined;
			}
			isAnimatingRef.current = false;
		};
	}, [animate, speedMs, text]);

	return animate ? stream : text;
}
