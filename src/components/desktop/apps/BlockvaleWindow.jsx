import React, { useCallback, useEffect, useRef, useState } from "react";
import blockvaleIcon from "../../../assets/icons/apps/blockvale.svg";
import minimizeIcon from "../../../assets/icons/ui/window-controls/Minimize.webp";
import maximizeIcon from "../../../assets/icons/ui/window-controls/Maximize.webp";
import closeIcon from "../../../assets/icons/ui/window-controls/Exit.webp";
import ResizeHandles from "../ResizeHandles";
import useWindowResize from "../hooks/useWindowResize";
import { getDesktopPoint } from "../utils/desktopTransform";
import "../../../styles/desktop/window.css";
import "../../../styles/desktop/apps/blockvale.css";

const GAME_URL = "/game/";
const SAVE_TIMEOUT_MS = 2000;

const getDefaultSize = () => {
  if (typeof window === "undefined") return { width: 960, height: 600 };
  return {
    width: Math.max(640, Math.min(1024, window.innerWidth - 160)),
    height: Math.max(420, Math.min(640, window.innerHeight - 140)),
  };
};

const getDefaultPosition = () => {
  if (typeof window === "undefined") return { x: 120, y: 50 };
  const size = getDefaultSize();
  return {
    x: Math.max(16, Math.round((window.innerWidth - size.width) / 2)),
    y: Math.max(16, Math.round((window.innerHeight - 30 - size.height) / 2)),
  };
};

/**
 * Hosts the Blockvale game (served from /game/) in an iframe so its pointer
 * lock, keyboard handling and render loop stay isolated from the desktop.
 */
const BlockvaleWindow = ({
  windowId,
  zIndex,
  onClose,
  onMinimize,
  onMaximize,
  onMouseDown,
  isActive = true,
  isMinimized = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [position, setPosition] = useState(getDefaultPosition);
  const [size, setSize] = useState(getDefaultSize);
  const iframeRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const originalPosition = useRef(position);
  const originalSize = useRef(size);
  const { startResize, isResizing } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 480,
    minHeight: 320,
    isMaximized,
    onFocus: () => onMouseDown(windowId),
  });

  const postToGame = useCallback((message) => {
    iframeRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  // Ask the game to flush its save before the iframe is torn down.
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener("message", onSaved);
      onClose(windowId);
    };
    const onSaved = (event) => {
      if (event.origin === window.location.origin && event.data?.type === "blockvale:saved") finish();
    };
    window.addEventListener("message", onSaved);
    postToGame({ type: "blockvale:request-save" });
    setTimeout(finish, SAVE_TIMEOUT_MS);
  }, [isClosing, onClose, postToGame, windowId]);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const type = event.data?.type;
      if (type === "blockvale:focus") onMouseDown(windowId);
      else if (type === "blockvale:close") onClose(windowId);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onClose, onMouseDown, windowId]);

  // Leaving the window (minimise, another window on top) pauses the game.
  useEffect(() => {
    if (isMinimized || !isActive) postToGame({ type: "blockvale:pause" });
  }, [isActive, isMinimized, postToGame]);

  useEffect(() => {
    if (!isMaximized) return undefined;
    const fit = () => setSize({ width: window.innerWidth, height: window.innerHeight - 30 });
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [isMaximized]);

  const toggleMaximize = () => {
    setIsMaximized((prev) => {
      if (!prev) {
        originalPosition.current = position;
        originalSize.current = size;
        setPosition({ x: 0, y: 0 });
        setSize({ width: window.innerWidth, height: window.innerHeight - 30 });
      } else {
        setPosition(originalPosition.current);
        setSize(originalSize.current);
      }
      return !prev;
    });
    onMaximize?.(windowId);
  };

  const handleHeaderMouseDown = (event) => {
    if (isMaximized || event.button !== 0) return;
    if (event.target.closest?.(".window-buttons")) return;
    const point = getDesktopPoint(event);
    dragOffset.current = { x: point.x - position.x, y: point.y - position.y };
    setIsDragging(true);
    onMouseDown(windowId);
  };

  useEffect(() => {
    if (!isDragging) return undefined;
    const move = (event) => {
      const point = getDesktopPoint(event);
      setPosition({
        x: point.x - dragOffset.current.x,
        y: Math.max(0, point.y - dragOffset.current.y),
      });
    };
    const up = () => setIsDragging(false);
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
  }, [isDragging]);

  return (
    <div
      className={`window blockvale-window ${isActive ? "" : "is-inactive"} ${isMaximized ? "maximized" : ""}`}
      style={{
        top: position.y,
        left: position.x,
        zIndex,
        width: size.width,
        height: size.height,
        display: isMinimized ? "none" : undefined,
      }}
      onMouseDown={() => onMouseDown(windowId)}
    >
      <div className="window-header" onMouseDown={handleHeaderMouseDown} onDoubleClick={toggleMaximize}>
        <div className="window-title">
          <img src={blockvaleIcon} alt="" className="window-title-icon" draggable="false" />
          <span>Blockvale</span>
        </div>
        <div className="window-buttons">
          <button type="button" className="window-btn minimize" onClick={() => onMinimize(windowId)}>
            <img src={minimizeIcon} alt="Minimize" />
          </button>
          <button type="button" className="window-btn maximize" onClick={toggleMaximize}>
            <img src={maximizeIcon} alt="Maximize" />
          </button>
          <button type="button" className="window-btn close" onClick={handleClose}>
            <img src={closeIcon} alt="Close" />
          </button>
        </div>
      </div>

      <div className="blockvale-body">
        <iframe
          ref={iframeRef}
          className="blockvale-frame"
          src={GAME_URL}
          title="Blockvale"
          allow="fullscreen; gamepad"
        />
        {/* The iframe swallows mouse events; this shield keeps drags and resizes smooth. */}
        {isDragging || isResizing ? <div className="blockvale-shield" /> : null}
        {isClosing ? <div className="blockvale-closing">Saving world…</div> : null}
      </div>
      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default BlockvaleWindow;
