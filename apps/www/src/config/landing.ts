/**
 * Landing page content and configuration constants
 */

export interface Application {
  name: string;
  status: "live" | "planned" | "future";
  logo?: string;
}

export interface IntegrationCategory {
  name: string;
  grid: {
    colStart: number;
    colSpan: number;
    rowStart: number;
    rowSpan: number;
  };
  applications: Application[];
  // Legacy fields for backwards compatibility
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
    applications: [
      {
        name: "Blender",
        status: "live",
        logo: "/creative-app-logos/blender.png",
      },
      { name: "Maya", status: "planned" },
      { name: "Cinema 4D", status: "planned" },
      { name: "3ds Max", status: "planned" },
      {
        name: "Houdini",
        status: "planned",
        logo: "/creative-app-logos/houdini.png",
      },
    ],
    apps: 5,
    liveApps: 1,
    plannedApps: 4,
  },
  {
    name: "Audio Production",
    grid: { colStart: 0, colSpan: 2, rowStart: 7, rowSpan: 5 }, // Left side, bottom portion
    applications: [
      { name: "Ableton Live", status: "planned" },
      { name: "Reaper", status: "planned" },
      { name: "Logic Pro", status: "future" },
    ],
    apps: 3,
    liveApps: 0,
    plannedApps: 2,
  },
  {
    name: "2D Graphics",
    grid: { colStart: 2, colSpan: 5, rowStart: 0, rowSpan: 5 }, // Top, left of center
    applications: [
      { name: "Photoshop", status: "planned" },
      { name: "Illustrator", status: "planned" },
      { name: "GIMP", status: "future" },
    ],
    apps: 3,
    liveApps: 0,
    plannedApps: 2,
  },
  {
    name: "Game Engines",
    grid: { colStart: 2, colSpan: 3, rowStart: 5, rowSpan: 7 }, // Bottom, left of center
    applications: [
      { name: "Unity", status: "planned" },
      { name: "Godot", status: "planned" },
    ],
    apps: 2,
    liveApps: 0,
    plannedApps: 2,
  },
  {
    name: "Video & VFX",
    grid: { colStart: 7, colSpan: 3, rowStart: 0, rowSpan: 7 }, // Top, right of center
    applications: [
      { name: "DaVinci Resolve", status: "planned" },
      { name: "Nuke", status: "planned" },
      { name: "Premiere Pro", status: "planned" },
      { name: "After Effects", status: "planned" },
      { name: "Final Cut Pro", status: "future" },
    ],
    apps: 5,
    liveApps: 0,
    plannedApps: 4,
  },
  {
    name: "Design Tools",
    grid: { colStart: 10, colSpan: 2, rowStart: 0, rowSpan: 4 }, // Right side, top portion
    applications: [
      { name: "Figma", status: "live" },
      { name: "Sketch", status: "future" },
      { name: "Canva", status: "future" },
    ],
    apps: 3,
    liveApps: 1,
    plannedApps: 0,
  },
  {
    name: "Interactive & Live",
    grid: { colStart: 10, colSpan: 2, rowStart: 4, rowSpan: 8 }, // Right side, bottom portion
    applications: [
      {
        name: "TouchDesigner",
        status: "planned",
        logo: "/creative-app-logos/touchdesigner.png",
      },
      { name: "Max/MSP", status: "planned" },
      {
        name: "Unreal Engine",
        status: "planned",
        logo: "/creative-app-logos/unreal-engine.png",
      },
      { name: "Processing", status: "future" },
      { name: "Resolume", status: "future" },
    ],
    apps: 5,
    liveApps: 0,
    plannedApps: 3,
  },
  {
    name: "3D Texturing & CAD",
    grid: { colStart: 5, colSpan: 5, rowStart: 7, rowSpan: 5 }, // Bottom, right of center
    applications: [
      { name: "Substance 3D", status: "planned" },
      { name: "OpenSCAD", status: "planned" },
      { name: "KeyShot", status: "future" },
    ],
    apps: 3,
    liveApps: 0,
    plannedApps: 2,
  },
];
