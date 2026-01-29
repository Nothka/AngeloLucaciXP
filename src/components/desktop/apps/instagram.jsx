import React, { useEffect, useRef, useState } from "react";
import instagramIcon from "../../../assets/startmenu/instagram.jpeg";
import closeIcon from "../../../assets/window/Exit.png";
import ResizeHandles from "../ResizeHandles";
import useWindowResize from "../hooks/useWindowResize";
import "../../../styles/desktop/window.css";
import "../../../styles/desktop/apps/instagram.css";

const INSTAGRAM_URL = "https://www.instagram.com/angelo.lucaci/";
const WINDOW_SIZE = { width: 360, height: 240 };

const getDefaultPosition = () => {
  if (typeof window === "undefined") return { x: 220, y: 180 };
  return {
    x: Math.max(40, Math.round((window.innerWidth - WINDOW_SIZE.width) / 2)),
    y: Math.max(40, Math.round((window.innerHeight - WINDOW_SIZE.height - 30) / 2)),
  };
};

const InstagramWindow = ({ windowId, onClose, zIndex, onMouseDown, isActive = true }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(getDefaultPosition);
  const [size, setSize] = useState(WINDOW_SIZE);
  const windowRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const { startResize } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 320,
    minHeight: 220,
    onFocus: () => onMouseDown(windowId),
  });

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    onMouseDown(windowId);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y,
    });
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleVisit = () => {
    window.open(INSTAGRAM_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={`window instagram-window ${isActive ? "" : "is-inactive"}`}
      ref={windowRef}
      style={{
        top: position.y,
        left: position.x,
        zIndex,
        width: size.width,
        height: size.height,
      }}
      onMouseDown={() => onMouseDown(windowId)}
    >
      <div className="window-header" onMouseDown={handleMouseDown}>
        <div className="window-title">
          <img
            src={instagramIcon}
            alt="Instagram"
            className="window-title-icon instagram-title-icon"
          />
          <span>Open Link</span>
        </div>
        <div className="window-buttons">
          <button className="window-btn close" onClick={() => onClose(windowId)}>
            <img src={closeIcon} alt="Close" />
          </button>
        </div>
      </div>

      <div className="instagram-body">
        <img src={instagramIcon} alt="Instagram" className="instagram-logo" />
        <h2>Open Link</h2>
        <p>Are you sure you want to open "Instagram"?</p>
        <div className="instagram-actions">
          <button type="button" className="instagram-btn" onClick={() => onClose(windowId)}>
            Cancel
          </button>
          <button type="button" className="instagram-btn is-primary" onClick={handleVisit}>
            Visit Instagram
          </button>
        </div>
      </div>
      <ResizeHandles onResizeStart={startResize} />
    </div>
  );
};

export default InstagramWindow;
