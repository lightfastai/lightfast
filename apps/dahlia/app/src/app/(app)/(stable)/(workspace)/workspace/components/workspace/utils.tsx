export const createPath = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) => {
  const MIN_OFFSET = 40; // Minimum distance for control points
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  // Control point distances - scales with total distance but has a minimum
  const controlDistance = Math.max(distance * 0.2, MIN_OFFSET);

  // Control points - positioned to ensure horizontal exit/entry
  const p1x = startX + controlDistance;
  const p1y = startY;
  const p2x = endX - controlDistance;
  const p2y = endY;

  return `M ${startX} ${startY} 
          C ${p1x} ${p1y}, 
            ${p2x} ${p2y}, 
            ${endX} ${endY}`;
};
