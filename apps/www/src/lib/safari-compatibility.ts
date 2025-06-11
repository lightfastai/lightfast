/**
 * Safari compatibility utilities for the landing page
 * Handles browser-specific fixes that can't be done with CSS alone
 */

/**
 * Detects if the browser is Safari (including iOS Safari)
 */
export const isSafari = (): boolean => {
  if (typeof window === "undefined") return false;
  
  const ua = window.navigator.userAgent.toLowerCase();
  const isSafariBrowser = ua.includes("safari") && !ua.includes("chrome") && !ua.includes("android");
  const isIOSSafari = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
  
  return isSafariBrowser || isIOSSafari;
};

/**
 * Detects if the browser is iOS Safari specifically
 */
export const isIOSSafari = (): boolean => {
  if (typeof window === "undefined") return false;
  
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
};

/**
 * Applies Safari-specific fixes for color transitions
 * Since Safari has issues with color-mix(), we use data attributes instead
 */
export const applySafariColorFix = (element: HTMLElement, state: "initial" | "earlyAccess"): void => {
  if (!isSafari()) return;
  
  // Remove color-mix and use data attributes for Safari
  element.setAttribute("data-state", state);
  
  // For browsers that don't support color-mix, update CSS variables directly
  if (!CSS.supports("background-color", "color-mix(in srgb, white, black)")) {
    const root = document.documentElement;
    if (state === "earlyAccess") {
      root.style.setProperty("--cc-bg-color", "black");
      root.style.setProperty("--cc-text-color", "white");
    } else {
      root.style.setProperty("--cc-bg-color", "white");
      root.style.setProperty("--cc-text-color", "black");
    }
  }
};

/**
 * Fixes Safari's viewport height issues (100vh includes Safari's UI chrome)
 */
export const fixSafariViewportHeight = (): (() => void) => {
  if (!isSafari()) return () => {};
  
  const updateViewportHeight = () => {
    // Get the actual viewport height excluding Safari's UI
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
    
    // Also update safe viewport dimensions
    document.documentElement.style.setProperty("--safe-viewport-height", `${window.innerHeight}px`);
    document.documentElement.style.setProperty("--safe-viewport-width", `${window.innerWidth}px`);
  };
  
  updateViewportHeight();
  window.addEventListener("resize", updateViewportHeight);
  window.addEventListener("orientationchange", updateViewportHeight);
  
  return () => {
    window.removeEventListener("resize", updateViewportHeight);
    window.removeEventListener("orientationchange", updateViewportHeight);
  };
};

/**
 * Fixes iOS Safari's scroll behavior issues
 */
export const fixIOSScrollBehavior = (isLocked: boolean): void => {
  if (!isIOSSafari()) return;
  
  const body = document.body;
  const html = document.documentElement;
  
  if (isLocked) {
    // Store current scroll position
    const scrollY = window.scrollY;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    html.style.overflow = "hidden";
    
    // Prevent iOS bounce scrolling
    document.addEventListener("touchmove", preventDefaultTouch, { passive: false });
  } else {
    // Restore scroll position
    const scrollY = Math.abs(parseInt(body.style.top || "0"));
    body.style.position = "";
    body.style.top = "";
    body.style.width = "";
    html.style.overflow = "";
    window.scrollTo(0, scrollY);
    
    // Re-enable touch scrolling
    document.removeEventListener("touchmove", preventDefaultTouch);
  }
};

const preventDefaultTouch = (e: TouchEvent) => {
  e.preventDefault();
};

/**
 * Optimizes animations for Safari by reducing complexity
 */
export const optimizeSafariAnimations = (): void => {
  if (!isSafari()) return;
  
  const root = document.documentElement;
  
  // Reduce animation durations for better performance
  if (isIOSSafari()) {
    root.style.setProperty("--grid-line-duration", "0.8s");
    root.style.setProperty("--grid-line-delay-step", "0.1s");
  }
  
  // Disable will-change on elements that don't need it
  const gridLines = document.querySelectorAll(
    ".grid-line-top, .grid-line-bottom, .grid-line-left, .grid-line-right"
  );
  gridLines.forEach((line) => {
    (line as HTMLElement).style.willChange = "auto";
  });
};

/**
 * Initialize all Safari fixes
 */
export const initSafariCompatibility = (): (() => void) => {
  if (!isSafari()) return () => {};
  
  // Apply all fixes
  const cleanupViewport = fixSafariViewportHeight();
  optimizeSafariAnimations();
  
  // Load Safari-specific CSS
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/components/landing/landing-safari-fixes.css";
  document.head.appendChild(link);
  
  console.log("Safari compatibility mode enabled");
  
  // Return cleanup function
  return () => {
    cleanupViewport();
    link.remove();
  };
};