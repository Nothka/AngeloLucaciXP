import React, { useEffect, useRef, useState } from "react";
import linkedinIcon from "../../../assets/startmenu/linkedin.webp";
import closeIcon from "../../../assets/window/Exit.webp";
import ResizeHandles from "../ResizeHandles";
import useWindowResize from "../hooks/useWindowResize";
import { getDesktopPoint } from "../utils/desktopTransform";
import "../../../styles/desktop/window.css";
import "../../../styles/desktop/apps/linkedin.css";

const LINKEDIN_URL = "https://www.linkedin.com/in/angelo-lucaci/";
const WINDOW_SIZE = { width: 360, height: 240 };

const getDefaultPosition = () => {
  if (typeof window === "undefined") return { x: 220, y: 180 };
  return {
    x: Math.max(40, Math.round((window.innerWidth - WINDOW_SIZE.width) / 2)),
    y: Math.max(40, Math.round((window.innerHeight - WINDOW_SIZE.height - 30) / 2)),
  };
};

const LinkedInWindow = ({ windowId, onClose, zIndex, onMouseDown, isActive = true }) => {
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
    const point = getDesktopPoint(e);
    dragOffset.current = {
      x: point.x - position.x,
      y: point.y - position.y,
    };
    onMouseDown(windowId);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const point = getDesktopPoint(e);
    setPosition({
      x: point.x - dragOffset.current.x,
      y: point.y - dragOffset.current.y,
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
    window.open(LINKEDIN_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={`window linkedin-window ${isActive ? "" : "is-inactive"}`}
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
          <span className="window-title-icon linkedin-title-icon" aria-hidden="true">
            in
          </span>
          <span>Open Link</span>
        </div>
        <div className="window-buttons">
          <button className="window-btn close" onClick={() => onClose(windowId)}>
            <img src={closeIcon} alt="Close" />
          </button>
        </div>
      </div>

      <div className="linkedin-body">
        <img src={linkedinIcon} alt="LinkedIn" className="linkedin-logo" />
        <h2>Open Link</h2>
        <p>Are you sure you want to open "LinkedIn"?</p>
        <div className="linkedin-actions">
          <button type="button" className="linkedin-btn" onClick={() => onClose(windowId)}>
            Cancel
          </button>
          <button type="button" className="linkedin-btn is-primary" onClick={handleVisit}>
            Visit LinkedIn
          </button>
        </div>
      </div>
      <ResizeHandles onResizeStart={startResize} />
    </div>
  );
};

export default LinkedInWindow;
