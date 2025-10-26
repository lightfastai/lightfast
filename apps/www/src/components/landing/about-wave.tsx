"use client"

import { useMemo } from "react"
import { Matrix  } from "@repo/ui/components/ui/matrix"
import type {Frame} from "@repo/ui/components/ui/matrix";

function generateWaveFrames(rows: number, cols: number, frameCount: number): Frame[] {
  const frames: Frame[] = []

  for (let frame = 0; frame < frameCount; frame++) {
    const f: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0) as number[])
    const phase = (frame / frameCount) * Math.PI * 2

    for (let col = 0; col < cols; col++) {
      const colPhase = (col / cols) * Math.PI * 2
      const height = Math.sin(phase + colPhase) * (rows / 3) + rows / 2
      const row = Math.floor(height)

      if (row >= 0 && row < rows) {
        const currentRow = f[row];
        if (currentRow) {
          currentRow[col] = 1;
          const frac = height - row;
          if (row > 0) {
            const prevRow = f[row - 1];
            if (prevRow) prevRow[col] = 1 - frac;
          }
          if (row < rows - 1) {
            const nextRow = f[row + 1];
            if (nextRow) nextRow[col] = frac;
          }
        }
      }
    }

    frames.push(f as Frame)
  }

  return frames
}

export function AboutWave() {
  // 4:3 aspect ratio - width:height = 4:3
  const cols = 40
  const rows = 30
  const frameCount = 48

  const waveFrames = useMemo(
    () => generateWaveFrames(rows, cols, frameCount),
    [rows, cols, frameCount]
  )

  return (
    <div className="flex items-center justify-center">
      <Matrix
        rows={rows}
        cols={cols}
        frames={waveFrames}
        fps={24}
        autoplay={true}
        loop={true}
        size={8}
        gap={2}
        brightness={1}
        ariaLabel="Continuous wave animation"
        className="opacity-90"
      />
    </div>
  )
}
