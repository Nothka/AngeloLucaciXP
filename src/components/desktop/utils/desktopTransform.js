const DEFAULT_TRANSFORM = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

export const getDesktopTransform = () => {
  if (typeof window === "undefined") return DEFAULT_TRANSFORM;
  return window.__desktopTransform || DEFAULT_TRANSFORM;
};

export const getDesktopPoint = (event) => {
  const { scale, offsetX, offsetY } = getDesktopTransform();
  return {
    x: (event.clientX - offsetX) / scale,
    y: (event.clientY - offsetY) / scale,
  };
};
