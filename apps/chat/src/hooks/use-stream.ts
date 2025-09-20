import { useCallback, useEffect, useRef, useState } from "react";

const TYPEWRITER_SPEED = 5; // 👇 milliseconds per character

export const useStream = () => {
	// 👇 internal buffer of chunks as they arrive from the server
	const [parts, setParts] = useState<string[]>([]);

	// 👇 the currently visible text
	const [stream, setStream] = useState("");
	const [isAnimating, setIsAnimating] = useState(false);

	const frame = useRef<number | null>(null);
	const lastTimeRef = useRef<number>(0);
	const streamIndexRef = useRef<number>(0);
	const isAnimatingRef = useRef(false);
	const fullTextRef = useRef("");

	const cancelFrame = useCallback(() => {
		if (frame.current) {
			cancelAnimationFrame(frame.current);
			frame.current = null;
		}
	}, []);

	const step = useCallback(
		(time: number) => {
			const target = fullTextRef.current;

			if (streamIndexRef.current < target.length) {
				if (time - lastTimeRef.current >= TYPEWRITER_SPEED) {
					streamIndexRef.current += 1;
					setStream(target.slice(0, streamIndexRef.current));
					lastTimeRef.current = time;
				}
				frame.current = requestAnimationFrame(step);
				return;
			}

			isAnimatingRef.current = false;
			setIsAnimating(false);
			cancelFrame();
		},
		[cancelFrame],
	);

	const start = useCallback(() => {
		if (isAnimatingRef.current) return;

		isAnimatingRef.current = true;
		setIsAnimating(true);
		frame.current = requestAnimationFrame(step);
	}, [step]);

	const addPart = useCallback((part: string) => {
		if (part) {
			setParts((prev) => [...prev, part]);
		}
	}, []);

	const reset = useCallback(() => {
		setParts([]);
		setStream("");
		streamIndexRef.current = 0;
		lastTimeRef.current = 0;
		fullTextRef.current = "";
		isAnimatingRef.current = false;
		setIsAnimating(false);
		cancelFrame();
	}, [cancelFrame]);

	useEffect(() => {
		const nextFullText = parts.join("");
		fullTextRef.current = nextFullText;

		if (nextFullText.length === 0) {
			setStream("");
			streamIndexRef.current = 0;
			lastTimeRef.current = 0;
			isAnimatingRef.current = false;
			setIsAnimating(false);
			cancelFrame();
			return;
		}

		if (streamIndexRef.current > nextFullText.length) {
			streamIndexRef.current = nextFullText.length;
		}

		if (streamIndexRef.current >= nextFullText.length) {
			setStream(nextFullText);
			isAnimatingRef.current = false;
			setIsAnimating(false);
			cancelFrame();
			return;
		}

		start();
	}, [parts, start, cancelFrame]);

	useEffect(() => {
		return () => {
			cancelFrame();
			isAnimatingRef.current = false;
		};
	}, [cancelFrame]);

	return { stream, addPart, reset, isAnimating };
};
