import React, { useState, useRef, useEffect } from "react";
import backIcon from "../../assets/icons/ui/window-controls/Back.webp";
import forwardIcon from "../../assets/icons/ui/window-controls/Forward.webp";
import favoritesIcon from "../../assets/icons/ui/window-controls/Favorites.webp";
import homeIcon from "../../assets/icons/ui/window-controls/home.webp";
import minimizeIcon from "../../assets/icons/ui/window-controls/Minimize.webp";
import maximizeIcon from "../../assets/icons/ui/window-controls/Maximize.webp";
import closeIcon from "../../assets/icons/ui/window-controls/Exit.webp";
import goIcon from "../../assets/icons/apps/adressbar/Go.webp";
import ResizeHandles from "./ResizeHandles";
import useWindowResize from "./hooks/useWindowResize";
import { getDesktopPoint } from "./utils/desktopTransform";

const getDefaultWindowSize = () => {
  if (typeof window === "undefined") return { width: 780, height: 520 };
  const maxWidth = Math.min(window.innerWidth - 120, 980);
  const maxHeight = Math.min(window.innerHeight - 140, 700);
  return {
    width: Math.max(640, maxWidth),
    height: Math.max(420, maxHeight),
  };
};

const getDefaultWindowPosition = () => {
  if (typeof window === "undefined") return { x: 60, y: 60 };
  return {
    x: Math.max(24, Math.min(120, window.innerWidth / 10)),
    y: 60,
  };
};

const Window = ({
  windowId,
  title,
  children,
  onClose,
  onMinimize,
  onMaximize,
  zIndex,
  onMouseDown,
  isActive = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState(getDefaultWindowPosition);
  const [size, setSize] = useState(getDefaultWindowSize);
  const windowRef = useRef(null);
  const dragStartPos = useRef(null);
  const originalPosition = useRef(getDefaultWindowPosition());
  const originalSize = useRef(getDefaultWindowSize());
  const { startResize } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 400,
    minHeight: 300,
    isMaximized,
    onFocus: () => onMouseDown(windowId),
  });


  useEffect(() => {
    if (isMaximized) {
      originalPosition.current = position;
      originalSize.current = size;
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight - 30 }); // -30 for taskbar
    } else {
      setPosition(originalPosition.current);
      setSize(originalSize.current);
    }
  }, [isMaximized]);

  const handleMouseDown = (e) => {
    if (isMaximized) return; // Prevent dragging when maximized
    setIsDragging(true);
    dragStartPos.current = getDesktopPoint(e);
    onMouseDown(windowId);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartPos.current = null;
  };

  const handleMouseMove = (e) => {
    if (!isDragging || isMaximized) return;
    const point = getDesktopPoint(e);
    const dx = point.x - dragStartPos.current.x;
    const dy = point.y - dragStartPos.current.y;
    setPosition({
      x: position.x + dx,
      y: position.y + dy,
    });
    dragStartPos.current = point;
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (onMaximize) onMaximize(windowId);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      className={`window ${isActive ? "" : "is-inactive"} ${isMaximized ? "maximized" : ""}`}
      ref={windowRef}
      style={{ top: position.y, left: position.x, zIndex, width: size.width, height: size.height }}
      onMouseDown={() => onMouseDown(windowId)}
    >
      <div className="window-header" onMouseDown={handleMouseDown} onDoubleClick={toggleMaximize}>
        <div className="window-title">
          <span>{title}</span>
        </div>
        <div className="window-buttons">
          <button className="window-btn minimize" onClick={() => onMinimize(windowId)}>
            <img src={minimizeIcon} alt="Minimize" />
          </button>
          <button className="window-btn maximize" onClick={toggleMaximize}>
            <img src={maximizeIcon} alt="Maximize" />
          </button>
          <button className="window-btn close" onClick={() => onClose(windowId)}>
            <img src={closeIcon} alt="Close" />
          </button>
        </div>
      </div>

      <div className="window-menu-bar">
        <button type="button" className="window-menu-btn">File</button>
        <button type="button" className="window-menu-btn">View</button>
        <div className="window-menu-btn is-muted">Tools</div>
        <div className="window-menu-btn is-muted">Help</div>
      </div>

      <div className="window-toolbar">
        <div className="window-nav">
          <div className="window-nav-btn">
            <img src={backIcon} alt="Back" />
            Back
          </div>
          <div className="window-nav-btn">
            <img src={forwardIcon} alt="Forward" />
            Forward
          </div>
          <div className="window-nav-btn">
            
            Home
          </div>
          <div className="window-nav-btn">
            <img src={favoritesIcon} alt="Favorites" />
            Favorites
          </div>
        </div>
        <button type="button" className="window-theme-toggle">Light/Dark</button>
      </div>

      <div className="window-address">
        <span className="address-label">Address</span>
        <div className="address-bar">
          <img src={homeIcon} alt="Address home" />
          <input
            type="text"
            value="https://www.myprojects.com"
            readOnly
            aria-label="Address bar"
          />
        </div>
        <div className="address-go">
          <img src={goIcon} alt="Go" />
          <span>Go</span>
        </div>
      </div>

      <div className="window-content">
        {children}
      </div>
      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default Window;
