/**
 * Stub for next/image — renders a plain <img> element.
 */
function NextImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  // biome-ignore lint/a11y/useAltText: test mock passes props through
  // biome-ignore lint/correctness/useImageSize: test mock passes props through
  // biome-ignore lint/performance/noImgElement: test mock intentionally renders plain <img>
  return <img {...props} />;
}

export default NextImage;
