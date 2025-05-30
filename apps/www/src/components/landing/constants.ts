export interface IntegrationCategory {
  name: string;
  grid: {
    colStart: number;
    colSpan: number;
    rowStart: number;
    rowSpan: number;
  };
  apps: number;
  liveApps: number;
  plannedApps: number;
}

// Integration data for the surrounding cards - using 12x12 grid system
// Center card will be at cols 5-6, rows 5-6 (2x2 area in middle)
export const integrationCategories: IntegrationCategory[] = [
  {
    name: "3D Modeling",
    grid: { colStart: 0, colSpan: 2, rowStart: 0, rowSpan: 7 }, // Left side, top portion
    apps: 7,
    liveApps: 1,
    plannedApps: 6,
  },
  {
    name: "Audio Production",
    grid: { colStart: 0, colSpan: 2, rowStart: 7, rowSpan: 5 }, // Left side, bottom portion
    apps: 5,
    liveApps: 0,
    plannedApps: 5,
  },
  {
    name: "2D Graphics",
    grid: { colStart: 2, colSpan: 5, rowStart: 0, rowSpan: 5 }, // Top, left of center
    apps: 5,
    liveApps: 0,
    plannedApps: 5,
  },
  {
    name: "Game Engines",
    grid: { colStart: 2, colSpan: 3, rowStart: 5, rowSpan: 7 }, // Bottom, left of center
    apps: 4,
    liveApps: 0,
    plannedApps: 4,
  },
  {
    name: "Video & VFX",
    grid: { colStart: 7, colSpan: 3, rowStart: 0, rowSpan: 7 }, // Top, right of center
    apps: 5,
    liveApps: 0,
    plannedApps: 5,
  },
  {
    name: "Design Tools",
    grid: { colStart: 10, colSpan: 2, rowStart: 0, rowSpan: 4 }, // Right side, top portion
    apps: 3,
    liveApps: 1,
    plannedApps: 2,
  },
  {
    name: "Interactive & Live",
    grid: { colStart: 10, colSpan: 2, rowStart: 4, rowSpan: 8 }, // Right side, bottom portion
    apps: 4,
    liveApps: 0,
    plannedApps: 4,
  },
  {
    name: "3D Texturing & CAD",
    grid: { colStart: 5, colSpan: 5, rowStart: 7, rowSpan: 5 }, // Bottom, right of center
    apps: 3,
    liveApps: 0,
    plannedApps: 3,
  },
];

// Grid constants
export const GRID_SIZE = 12;
export const CENTER_START = 5;
export const CENTER_SIZE = 2;
export const CENTER_END = CENTER_START + CENTER_SIZE;
