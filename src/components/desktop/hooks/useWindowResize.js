import { useEffect, useRef, useState } from "react";
import { getDesktopPoint } from "../utils/desktopTransform";

const DEFAULT_MIN_WIDTH = 320;
const DEFAULT_MIN_HEIGHT = 200;

const useWindowResize = ({
  position,
  size,
  setPosition,
  setSize,
  minWidth = DEFAULT_MIN_WIDTH,
  minHeight = DEFAULT_MIN_HEIGHT,
  isMaximized = false,
  onFocus,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef(null);

  const startResize = (event, direction) => {
    if (isMaximized) return;
    event.preventDefault();
    event.stopPropagation();
    if (onFocus) onFocus();
    const startPoint = getDesktopPoint(event);
    resizeRef.current = {
      direction,
      startX: startPoint.x,
      startY: startPoint.y,
      startWidth: size.width,
      startHeight: size.height,
      startLeft: position.x,
      startTop: position.y,
    };
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event) => {
      if (!resizeRef.current) return;
      const {
        direction,
        startX,
        startY,
        startWidth,
        startHeight,
        startLeft,
        startTop,
      } = resizeRef.current;
      const currentPoint = getDesktopPoint(event);
      const dx = currentPoint.x - startX;
      const dy = currentPoint.y - startY;
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;

      if (direction.includes("e")) {
        newWidth = Math.max(minWidth, startWidth + dx);
      }
      if (direction.includes("s")) {
        newHeight = Math.max(minHeight, startHeight + dy);
      }
      if (direction.includes("w")) {
        newWidth = Math.max(minWidth, startWidth - dx);
        newLeft = startLeft + (startWidth - newWidth);
      }
      if (direction.includes("n")) {
        newHeight = Math.max(minHeight, startHeight - dy);
        newTop = startTop + (startHeight - newHeight);
      }

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newLeft, y: newTop });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, minWidth, minHeight, setPosition, setSize]);

  return { startResize, isResizing };
};

export default useWindowResize;
