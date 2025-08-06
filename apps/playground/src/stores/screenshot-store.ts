"use client";

import { create } from "zustand";

interface Screenshot {
  id: string;
  url: string;
  timestamp: number;
  filename?: string;
}

interface ScreenshotStore {
  screenshots: Screenshot[];
  currentIndex: number;
  maxScreenshots: number;
  addScreenshot: (url: string, filename?: string) => void;
  setCurrentIndex: (index: number) => void;
  getCurrentScreenshot: () => Screenshot | null;
  getLatestScreenshot: () => Screenshot | null;
  clearScreenshots: () => void;
  hasScreenshot: (url: string) => boolean;
}

const MAX_SCREENSHOTS = 50; // Prevent memory issues

export const useScreenshotStore = create<ScreenshotStore>((set, get) => ({
  screenshots: [],
  currentIndex: -1,
  maxScreenshots: MAX_SCREENSHOTS,
  
  addScreenshot: (url: string, filename?: string) => {
    const state = get();
    
    // Check for duplicates
    if (state.screenshots.some(s => s.url === url)) {
      // If screenshot already exists, just update the index to show it
      const existingIndex = state.screenshots.findIndex(s => s.url === url);
      set({ currentIndex: existingIndex });
      return;
    }
    
    const screenshot: Screenshot = {
      id: `screenshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      timestamp: Date.now(),
      filename,
    };
    
    set((state) => {
      let newScreenshots = [...state.screenshots, screenshot];
      
      // Implement FIFO eviction if we exceed max
      if (newScreenshots.length > MAX_SCREENSHOTS) {
        newScreenshots = newScreenshots.slice(-MAX_SCREENSHOTS);
      }
      
      return {
        screenshots: newScreenshots,
        currentIndex: newScreenshots.length - 1, // Fixed: correct index for new screenshot
      };
    });
  },
  
  setCurrentIndex: (index: number) => {
    set((state) => ({
      currentIndex: Math.max(-1, Math.min(index, state.screenshots.length - 1)),
    }));
  },
  
  getCurrentScreenshot: () => {
    const state = get();
    if (state.currentIndex >= 0 && state.currentIndex < state.screenshots.length) {
      return state.screenshots[state.currentIndex];
    }
    return null;
  },
  
  getLatestScreenshot: () => {
    const state = get();
    if (state.screenshots.length > 0) {
      return state.screenshots[state.screenshots.length - 1];
    }
    return null;
  },
  
  clearScreenshots: () => {
    set({
      screenshots: [],
      currentIndex: -1,
    });
  },
  
  hasScreenshot: (url: string) => {
    const state = get();
    return state.screenshots.some(s => s.url === url);
  },
}));