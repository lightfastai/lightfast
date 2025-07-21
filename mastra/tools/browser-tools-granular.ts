import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { stagehandManager } from "../lib/stagehand-manager";

// Browser View - View current page state
export const browserViewTool = createTool({
	id: "browser-view",
	description: "View content of the current browser page",
	inputSchema: z.object({}),
	outputSchema: z.object({
		url: z.string(),
		title: z.string(),
		content: z.string().describe("Visible text content on the page"),
	}),
	execute: async () => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();
			const page = stagehand.page;

			const url = page.url();
			const title = await page.title();
			const content = await page.evaluate(() => {
				// Extract visible text content
				const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
					acceptNode: (node) => {
						const parent = node.parentElement;
						if (!parent) return NodeFilter.FILTER_REJECT;
						const tagName = parent.tagName.toLowerCase();
						if (["script", "style", "noscript"].includes(tagName)) {
							return NodeFilter.FILTER_REJECT;
						}
						const style = window.getComputedStyle(parent);
						if (style.display === "none" || style.visibility === "hidden") {
							return NodeFilter.FILTER_REJECT;
						}
						return node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
					},
				});

				const textNodes = [];
				let node: Node | null;
				node = walker.nextNode();
				while (node !== null) {
					if (node.nodeValue?.trim()) {
						textNodes.push(node.nodeValue.trim());
					}
					node = walker.nextNode();
				}
				return textNodes.join(" ");
			});

			return { url, title, content };
		} catch (error) {
			throw new Error(`Failed to view browser page: ${error instanceof Error ? error.message : String(error)}`);
		}
	},
});

// Browser Click - Click on elements
export const browserClickTool = createTool({
	id: "browser-click",
	description: "Click on elements in the current browser page",
	inputSchema: z.object({
		selector: z.string().optional().describe("CSS selector of element to click"),
		text: z.string().optional().describe("Text content of element to click"),
		index: z.number().optional().describe("Index if multiple matching elements (0-based)"),
		coordinates: z
			.object({
				x: z.number(),
				y: z.number(),
			})
			.optional()
			.describe("Click at specific coordinates"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();
			const page = stagehand.page;

			if (context.coordinates) {
				// Click at coordinates
				await page.mouse.click(context.coordinates.x, context.coordinates.y);
				return {
					success: true,
					message: `Clicked at coordinates (${context.coordinates.x}, ${context.coordinates.y})`,
				};
			}

			// Use Stagehand's act method for intelligent clicking
			let action = "click on ";
			if (context.selector) {
				action += `element matching selector "${context.selector}"`;
			} else if (context.text) {
				action += `element with text "${context.text}"`;
			} else {
				throw new Error("Must provide either selector, text, or coordinates");
			}

			if (context.index !== undefined) {
				action += ` at index ${context.index}`;
			}

			await stagehand.page.act({ action });

			return {
				success: true,
				message: `Successfully clicked on element`,
			};
		} catch (error) {
			return {
				success: false,
				message: `Click failed: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	},
});

// Browser Type - Type text into input fields
export const browserTypeTool = createTool({
	id: "browser-type",
	description: "Type text into editable elements",
	inputSchema: z.object({
		selector: z.string().optional().describe("CSS selector of input element"),
		text: z.string().describe("Text to type"),
		clear: z.boolean().optional().describe("Clear existing text before typing"),
		pressEnter: z.boolean().optional().describe("Press Enter after typing"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();

			// Build action string
			let action = "";
			if (context.clear) {
				action += "clear and ";
			}
			action += `type "${context.text}"`;
			if (context.selector) {
				action += ` in element matching selector "${context.selector}"`;
			}
			if (context.pressEnter) {
				action += " and press Enter";
			}

			await stagehand.page.act({ action });

			return {
				success: true,
				message: `Successfully typed text`,
			};
		} catch (error) {
			return {
				success: false,
				message: `Type failed: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	},
});

// Browser Select Option - Select from dropdown
export const browserSelectOptionTool = createTool({
	id: "browser-select-option",
	description: "Select an option from a dropdown",
	inputSchema: z.object({
		selector: z.string().optional().describe("CSS selector of select element"),
		value: z.string().optional().describe("Value to select"),
		text: z.string().optional().describe("Text of option to select"),
		index: z.number().optional().describe("Index of option to select (0-based)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();

			// Build action string
			let action = "select ";
			if (context.value) {
				action += `option with value "${context.value}"`;
			} else if (context.text) {
				action += `option with text "${context.text}"`;
			} else if (context.index !== undefined) {
				action += `option at index ${context.index}`;
			} else {
				throw new Error("Must provide either value, text, or index");
			}

			if (context.selector) {
				action += ` from dropdown matching selector "${context.selector}"`;
			}

			await stagehand.page.act({ action });

			return {
				success: true,
				message: `Successfully selected option`,
			};
		} catch (error) {
			return {
				success: false,
				message: `Select failed: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	},
});

// Browser Scroll - Scroll the page
export const browserScrollTool = createTool({
	id: "browser-scroll",
	description: "Scroll the browser page",
	inputSchema: z.object({
		direction: z.enum(["up", "down", "left", "right"]),
		amount: z.number().optional().describe("Pixels to scroll (default: one viewport)"),
		toTop: z.boolean().optional().describe("Scroll to top of page"),
		toBottom: z.boolean().optional().describe("Scroll to bottom of page"),
		smooth: z.boolean().optional().describe("Use smooth scrolling"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		scrollPosition: z.object({
			x: z.number(),
			y: z.number(),
		}),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();
			const page = stagehand.page;

			// Execute scroll
			const scrollPosition = await page.evaluate(
				({ direction, amount, toTop, toBottom, smooth }) => {
					const behavior = smooth ? "smooth" : "auto";

					if (toTop) {
						window.scrollTo({ top: 0, behavior });
					} else if (toBottom) {
						window.scrollTo({ top: document.body.scrollHeight, behavior });
					} else {
						const currentX = window.scrollX;
						const currentY = window.scrollY;
						const viewportHeight = window.innerHeight;
						const viewportWidth = window.innerWidth;
						const scrollAmount =
							amount || (direction === "up" || direction === "down" ? viewportHeight : viewportWidth);

						let newX = currentX;
						let newY = currentY;

						switch (direction) {
							case "up":
								newY = Math.max(0, currentY - scrollAmount);
								break;
							case "down":
								newY = currentY + scrollAmount;
								break;
							case "left":
								newX = Math.max(0, currentX - scrollAmount);
								break;
							case "right":
								newX = currentX + scrollAmount;
								break;
						}

						window.scrollTo({ left: newX, top: newY, behavior });
					}

					// Return new position
					return {
						x: window.scrollX,
						y: window.scrollY,
					};
				},
				{
					direction: context.direction,
					amount: context.amount,
					toTop: context.toTop,
					toBottom: context.toBottom,
					smooth: context.smooth,
				},
			);

			return {
				success: true,
				message: `Scrolled ${context.toTop ? "to top" : context.toBottom ? "to bottom" : context.direction}`,
				scrollPosition,
			};
		} catch (error) {
			return {
				success: false,
				message: `Scroll failed: ${error instanceof Error ? error.message : String(error)}`,
				scrollPosition: { x: 0, y: 0 },
			};
		}
	},
});

// Browser Press Key - Press keyboard keys
export const browserPressKeyTool = createTool({
	id: "browser-press-key",
	description: "Press keyboard keys in the browser",
	inputSchema: z.object({
		key: z.string().describe("Key to press (e.g., 'Enter', 'Tab', 'Control+C')"),
		count: z.number().optional().describe("Number of times to press the key"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();
			const page = stagehand.page;

			const count = context.count || 1;

			// Handle key combinations
			const keys = context.key.split("+").map((k) => k.trim());

			for (let i = 0; i < count; i++) {
				if (keys.length > 1) {
					// Handle key combination
					const modifiers = keys.slice(0, -1);
					const mainKey = keys[keys.length - 1];

					// Press modifiers
					for (const modifier of modifiers) {
						await page.keyboard.down(modifier);
					}

					// Press main key
					await page.keyboard.press(mainKey);

					// Release modifiers
					for (const modifier of modifiers.reverse()) {
						await page.keyboard.up(modifier);
					}
				} else {
					// Single key press
					await page.keyboard.press(context.key);
				}
			}

			return {
				success: true,
				message: `Pressed ${context.key}${count > 1 ? ` ${count} times` : ""}`,
			};
		} catch (error) {
			return {
				success: false,
				message: `Key press failed: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	},
});

// Browser Move Mouse - Move cursor to position
export const browserMoveMouseTool = createTool({
	id: "browser-move-mouse",
	description: "Move cursor to specified position",
	inputSchema: z.object({
		x: z.number().describe("X coordinate"),
		y: z.number().describe("Y coordinate"),
		steps: z.number().optional().describe("Number of intermediate steps for smooth movement"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();
			const page = stagehand.page;

			await page.mouse.move(context.x, context.y, { steps: context.steps || 1 });

			return {
				success: true,
				message: `Moved mouse to (${context.x}, ${context.y})`,
			};
		} catch (error) {
			return {
				success: false,
				message: `Mouse move failed: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	},
});

// Browser Wait - Wait for conditions
export const browserWaitTool = createTool({
	id: "browser-wait",
	description: "Wait for specific conditions on the page",
	inputSchema: z.object({
		type: z.enum(["selector", "text", "time", "navigation", "network"]),
		selector: z.string().optional().describe("CSS selector to wait for"),
		text: z.string().optional().describe("Text to wait for on page"),
		milliseconds: z.number().optional().describe("Time to wait in milliseconds"),
		state: z
			.enum(["attached", "detached", "visible", "hidden"])
			.optional()
			.describe("State to wait for (for selector)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();
			const page = stagehand.page;

			switch (context.type) {
				case "selector":
					if (!context.selector) throw new Error("Selector required for selector wait");
					await page.waitForSelector(context.selector, { state: context.state || "visible" });
					return { success: true, message: `Element ${context.selector} is ${context.state || "visible"}` };

				case "text":
					if (!context.text) throw new Error("Text required for text wait");
					await page.waitForFunction((text) => document.body.innerText.includes(text), context.text);
					return { success: true, message: `Text "${context.text}" appeared on page` };

				case "time":
					if (!context.milliseconds) throw new Error("Milliseconds required for time wait");
					await page.waitForTimeout(context.milliseconds);
					return { success: true, message: `Waited ${context.milliseconds}ms` };

				case "navigation":
					await page.waitForLoadState("networkidle");
					return { success: true, message: "Page navigation completed" };

				case "network":
					await page.waitForLoadState("networkidle");
					return { success: true, message: "Network is idle" };

				default:
					throw new Error("Invalid wait type");
			}
		} catch (error) {
			return {
				success: false,
				message: `Wait failed: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	},
});

// Browser Screenshot - Take screenshots
export const browserScreenshotTool = createTool({
	id: "browser-screenshot",
	description: "Take a screenshot of the current page",
	inputSchema: z.object({
		fullPage: z.boolean().optional().describe("Capture full page instead of viewport"),
		selector: z.string().optional().describe("CSS selector of element to screenshot"),
		path: z.string().optional().describe("Path to save screenshot"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		path: z.string().optional(),
		base64: z.string().optional().describe("Base64 encoded screenshot if no path provided"),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();
			const page = stagehand.page;

			const options: any = {
				fullPage: context.fullPage,
				path: context.path,
			};

			let screenshot: Buffer;

			if (context.selector) {
				const element = await page.$(context.selector);
				if (!element) throw new Error(`Element not found: ${context.selector}`);
				screenshot = await element.screenshot(options);
			} else {
				screenshot = await page.screenshot(options);
			}

			return {
				success: true,
				path: context.path,
				base64: context.path ? undefined : screenshot.toString("base64"),
			};
		} catch (_error) {
			return {
				success: false,
				path: undefined,
				base64: undefined,
			};
		}
	},
});

// Browser Console - Execute JavaScript
export const browserConsoleExecTool = createTool({
	id: "browser-console-exec",
	description: "Execute JavaScript code in browser console",
	inputSchema: z.object({
		javascript: z.string().describe("JavaScript code to execute"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		result: z.any().optional(),
		error: z.string().optional(),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();
			const page = stagehand.page;

			const result = await page.evaluate((code) => {
				// Create a function to execute the code and capture the result
				try {
					const fn = new Function(code);
					return { success: true, result: fn() };
				} catch (error) {
					return { success: false, error: error instanceof Error ? error.message : String(error) };
				}
			}, context.javascript);

			if (result.success) {
				return {
					success: true,
					result: result.result,
				};
			} else {
				return {
					success: false,
					error: result.error,
				};
			}
		} catch (error) {
			return {
				success: false,
				error: `Console execution failed: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	},
});

// Browser Reload - Reload the current page
export const browserReloadTool = createTool({
	id: "browser-reload",
	description: "Reload the current browser page",
	inputSchema: z.object({
		hard: z.boolean().optional().describe("Hard reload (bypass cache)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();
			const page = stagehand.page;

			await page.reload({ waitUntil: "networkidle" });

			return {
				success: true,
				message: `Page reloaded${context.hard ? " (hard reload)" : ""}`,
			};
		} catch (error) {
			return {
				success: false,
				message: `Reload failed: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	},
});

// Browser Back/Forward - Navigate history
export const browserHistoryTool = createTool({
	id: "browser-history",
	description: "Navigate browser history",
	inputSchema: z.object({
		action: z.enum(["back", "forward"]),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		url: z.string().optional(),
	}),
	execute: async ({ context }) => {
		try {
			const stagehand = await stagehandManager.ensureStagehand();
			const page = stagehand.page;

			if (context.action === "back") {
				await page.goBack({ waitUntil: "networkidle" });
			} else {
				await page.goForward({ waitUntil: "networkidle" });
			}

			const url = page.url();

			return {
				success: true,
				message: `Navigated ${context.action}`,
				url,
			};
		} catch (error) {
			return {
				success: false,
				message: `History navigation failed: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	},
});

// Export all tools
export const granularBrowserTools = {
	browserView: browserViewTool,
	browserClick: browserClickTool,
	browserType: browserTypeTool,
	browserSelectOption: browserSelectOptionTool,
	browserScroll: browserScrollTool,
	browserPressKey: browserPressKeyTool,
	browserMoveMouse: browserMoveMouseTool,
	browserWait: browserWaitTool,
	browserScreenshot: browserScreenshotTool,
	browserConsoleExec: browserConsoleExecTool,
	browserReload: browserReloadTool,
	browserHistory: browserHistoryTool,
};
