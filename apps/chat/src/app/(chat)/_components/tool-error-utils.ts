interface FormattedToolError {
	formattedError: string;
	isStructured: boolean;
}

// Attempt to format arbitrary tool error payloads for readable display
export function formatToolErrorPayload(
	errorText: unknown,
	fallback: string,
): FormattedToolError {
	if (errorText === undefined || errorText === null) {
		return { formattedError: fallback, isStructured: false };
	}

	if (typeof errorText === "string") {
		const trimmed = errorText.trim();
		if (!trimmed) {
			return { formattedError: fallback, isStructured: false };
		}

		if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
			try {
				return {
					formattedError: JSON.stringify(JSON.parse(trimmed), null, 2),
					isStructured: true,
				};
			} catch {
				return { formattedError: trimmed, isStructured: false };
			}
		}

		return { formattedError: trimmed, isStructured: false };
	}

	try {
		return {
			formattedError: JSON.stringify(errorText, null, 2),
			isStructured: true,
		};
	} catch {
		return { formattedError: fallback, isStructured: false };
	}
}
