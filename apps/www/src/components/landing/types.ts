export interface ViewportSize {
  width: number;
  height: number;
}

export interface GridLayout {
  cellSize: number; // Keep for backward compatibility with center card
  cellWidth: number; // Separate width dimension for cards
  cellHeight: number; // Separate height dimension for cards
  gridWidth: number;
  gridHeight: number;
  gridOffsetX: number;
  gridOffsetY: number;
  containerWidth: number;
  containerHeight: number;
}

export interface CenterCard {
  size: number; // Keep for backward compatibility
  width: number; // Actual width of the card
  height: number; // Actual height of the card
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
