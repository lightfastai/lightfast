import { source } from "@/src/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

export const { GET } = createFromSource(source, {
	// Orama configuration
	// See: https://docs.orama.com/open-source/supported-languages
	language: "english",
	// Optional: Configure search options
	search: {
		// Include content in search
		includeContent: true,
		// Include sections/headings in search
		includeSections: true,
		// Tokenizer options for better search results
		tokenizer: {
			// Split on word boundaries
			splitOn: /[\s\-_\.]+/,
		},
	},
});

