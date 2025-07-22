"use client";

import { useEffect, useRef } from "react";
import { useDataStream } from "./data-stream-provider";

export function DataStreamHandler() {
	const { dataStream } = useDataStream();
	const lastProcessedIndex = useRef(-1);

	useEffect(() => {
		if (!dataStream?.length) return;

		const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
		lastProcessedIndex.current = dataStream.length - 1;

		// Process any new data stream parts
		// This is where you can handle different data types if needed
		newDeltas.forEach((delta) => {
			// Handle different delta types as needed
			// For now, we'll just log them
			if (process.env.NODE_ENV === "development") {
				console.log("[DataStreamHandler] Processing delta:", delta);
			}
		});
	}, [dataStream]);

	return null;
}
