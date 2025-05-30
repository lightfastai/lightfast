export interface ViewportSize {
  width: number;
  height: number;
}

export interface GridLayout {
  cellSize: number;
  gridWidth: number;
  gridHeight: number;
  gridOffsetX: number;
  gridOffsetY: number;
  containerWidth: number;
  containerHeight: number;
}

export interface CenterCard {
  size: number;
  centerX: number;
  centerY: number;
  left: number;
  top: number;
  gridCenterX: number;
  gridCenterY: number;
}

export interface AnimationPhases {
  textFadePhase: number;
  logoMovePhase: number;
  expansionPhase: number;
  categoryPhase: number;
}
