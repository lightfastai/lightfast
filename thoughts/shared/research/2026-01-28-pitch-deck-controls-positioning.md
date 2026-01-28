---
date: 2026-01-28T17:30:00+08:00
researcher: Claude
git_commit: 272686c714e3aea1261a322a92a67355de65c8bd
branch: feat/pitch-deck-page
repository: lightfast
topic: "Pitch Deck Controls Positioning Analysis"
tags: [research, pitch-deck, ui-controls, layout]
status: complete
last_updated: 2026-01-28
last_updated_by: Claude
---

# Research: Pitch Deck Controls Positioning Analysis

**Date**: 2026-01-28T17:30:00+08:00
**Researcher**: Claude
**Git Commit**: 272686c714e3aea1261a322a92a67355de65c8bd
**Branch**: feat/pitch-deck-page
**Repository**: lightfast

## Research Question
Consider the whole layout of the pitch-deck directory - where should the "controls" (specifically the export/download control) be positioned? Currently it's next to CONTACT. Should it stay there or is there a better spot?

## Summary

The pitch-deck layout uses a **three-column header grid** on desktop (`md:grid-cols-[1fr_auto_1fr]`) with:
- **Left**: Logo + PrefaceToggle
- **Center**: Navigation Menu (MENU dropdown)
- **Right**: DownloadButton + CONTACT link

The current positioning of the download control next to CONTACT is a reasonable choice that groups action items together on the right side.

## Current Layout Structure

### Header (layout.tsx:24-51)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [LOGO] [⊏]          [MENU ▾]          [↓] CONTACT                          │
│  Left column          Center            Right column                        │
│  justify-self-start   auto             justify-self-end                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

The header is a fixed navbar using:
- `fixed top-0 left-0 right-0 z-50`
- Three-column grid on desktop: `md:grid-cols-[1fr_auto_1fr]`
- Falls back to flexbox with `justify-between` on mobile

### Control Components

| Control | Location | Purpose |
|---------|----------|---------|
| PrefaceToggle | Left column, next to logo | Toggles the founder's note sidebar |
| PitchDeckNavbar | Center | MENU dropdown for site navigation |
| DownloadButton | Right column | Exports slides to PDF |
| CONTACT link | Right column | Email link to jp@lightfast.ai |

### Other UI Controls in the Slide View

- **SlideIndicator** (`pitch-deck.tsx:212-228`): Fixed position dots on the right edge (`fixed right-3 top-1/2`) for navigating between slides
- **Keyboard navigation** (`pitch-deck.tsx:39-63`): Arrow keys, Space, PageUp/Down, Home/End for slide navigation

## Code References

- `apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx:24-51` - Header structure and control placement
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/download-button.tsx:1-43` - Download button component
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/preface-toggle.tsx:1-26` - Preface toggle component
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-navbar.tsx:1-48` - Navigation menu
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:201-228` - SlideIndicator component

## Observations on Current Control Groupings

1. **Left side controls**: Both logo and preface toggle relate to "context/identity" - the logo identifies the brand, the toggle reveals founder context
2. **Center control**: Navigation to other parts of the site, separate from pitch-specific actions
3. **Right side controls**: Both download and contact are "action" controls - ways for the viewer to take action after viewing the deck

## Alternative Positioning Considerations

The current layout follows a logical grouping. Other positions that could be considered:

1. **Near the slide indicator (right edge)**: Would associate download with slide navigation, but the indicator is scroll-based UI while download is a discrete action
2. **In the center with MENU**: Would hide it in a dropdown, reducing visibility
3. **Left side with preface toggle**: Could work thematically (both are "utility" controls), but would create asymmetry
4. **Floating/fixed position elsewhere**: Would break the clean header pattern

## Architecture Documentation

The layout uses a provider pattern (`PitchDeckProvider`) to share state across components:
- `prefaceExpanded` state controls the split-view layout
- `isGridView` state controls whether slides are shown in grid view or scroll view

The download functionality is self-contained in `DownloadButton` using `exportSlidesToPdf()` from `_lib/export-slides`.
