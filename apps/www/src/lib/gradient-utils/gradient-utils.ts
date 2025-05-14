export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
}

export function generateHarmoniousColors(count = 3) {
  // Color schemes with different hue steps
  const schemes = [
    { count: 3, hueStep: 30 }, // Analogous
    { count: 3, hueStep: 120 }, // Triadic
    { count: 4, hueStep: 90 }, // Tetradic
    { count: 2, hueStep: 180 }, // Complementary
  ];

  // Default to the first scheme if there's an issue with the random selection
  const scheme =
    schemes[Math.floor(Math.random() * schemes.length)] || schemes[0];
  const baseHue = Math.random() * 360;

  // Saturation and lightness ranges
  const satRange = { min: 70, max: 100 };
  const lightRange = { min: 60, max: 80 };

  // Generate colors from the scheme
  const colors = Array.from({ length: count }, (_, i) => {
    const hue = (baseHue + (i % scheme.count) * scheme.hueStep) % 360;
    const sat = satRange.min + Math.random() * (satRange.max - satRange.min);
    const light =
      lightRange.min + Math.random() * (lightRange.max - lightRange.min);
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  });

  return colors;
}

export function generateGradientProps(width: number, height: number) {
  const colors = generateHarmoniousColors(3);

  return {
    width,
    height,
    backgroundColor: "#000000",
    circles: colors.map((color) => ({
      color,
      cx: Math.random() * 100,
      cy: Math.random() * 100,
    })),
    blur: 600,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    grainIntensity: 15,
  };
}
