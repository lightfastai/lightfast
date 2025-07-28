export function textToBinary(text: string): string {
  return text
    .split('')
    .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
    .join(' ');
}

export function generateBinaryInstances(
  binary: string,
  count: number,
  screenWidth: number,
  screenHeight: number
): {
  id: string;
  text: string;
  x: number;
  y: number;
}[] {
  const instances = [];
  const binaryGroups = binary.split(' ');
  
  // Calculate row height based on font size (12px) + some spacing
  const rowHeight = 20;
  // Start from -50px and go to screenHeight + 50px
  const startY = -50;
  const endY = screenHeight + 50;
  const totalHeight = endY - startY;
  const maxRows = Math.floor(totalHeight / rowHeight);
  const actualCount = Math.min(count, maxRows);
  
  for (let i = 0; i < actualCount; i++) {
    // Randomly select starting point in the binary sequence
    const startIndex = Math.floor(Math.random() * binaryGroups.length);
    
    // Create a circular slice that can wrap around
    const sliceLength = Math.floor(Math.random() * 3) + 2; // 2-4 groups
    const endIndex = startIndex + sliceLength;
    
    let text = '';
    if (endIndex <= binaryGroups.length) {
      text = binaryGroups.slice(startIndex, endIndex).join(' ');
    } else {
      // Wrap around to the beginning
      text = [
        ...binaryGroups.slice(startIndex),
        ...binaryGroups.slice(0, endIndex - binaryGroups.length)
      ].join(' ');
    }
    
    // Random x position starting from negative values up to 0
    const x = Math.random() * -50; // -50 to 0px from left edge
    // Sequential y position in rows starting from -50px
    const y = startY + (i * rowHeight);
    
    instances.push({
      id: `binary-${i}`,
      text,
      x,
      y
    });
  }
  
  return instances;
}