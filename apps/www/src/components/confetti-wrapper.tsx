"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

const Confetti = dynamic(() => import("react-confetti"), {
	ssr: false,
});

export function ConfettiWrapper() {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		return () => setMounted(false);
	}, []);

	if (!mounted) return null;

	return createPortal(
		<Confetti
			recycle={false}
			numberOfPieces={200}
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				zIndex: 9999,
			}}
		/>,
		document.body
	);
}
