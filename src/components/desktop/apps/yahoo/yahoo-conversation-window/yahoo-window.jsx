import React, { useEffect, useRef, useState } from "react";
import typingIcon from "../../../../../assets/yahoo/yahoo-window/typing.png";
import minimizeIcon from "../../../../../assets/yahoo/header/window-minimize.png";
import maximizeIcon from "../../../../../assets/yahoo/header/maximise.png";
import closeIcon from "../../../../../assets/yahoo/header/close.png";
import YahooConversationWindowDesign from "./yahoo-window-design";
import ResizeHandles from "../../../ResizeHandles";
import useWindowResize from "../../../hooks/useWindowResize";
import "../../../../../styles/desktop/window.css";
import "../../../../../styles/desktop/apps/yahoo/yahoo-conversation-window/yahoo-window.css";

const WINDOW_SIZE = { width: 360, height: 640 };

const getDefaultPosition = () => {
  if (typeof window === "undefined") return { x: 260, y: 90 };
  return {
    x: Math.max(60, Math.round((window.innerWidth - WINDOW_SIZE.width) / 2)),
    y: Math.max(60, Math.round((window.innerHeight - WINDOW_SIZE.height - 30) / 2)),
  };
};

const YahooConversationWindow = ({
  windowId,
  title = "softpedia_review3, softpedia...",
  contactName = "softpedia_review3",
  contactImage,
  username = "angelo_lucaci",
  messages = [],
  draft = "",
  statusMessage,
  statusType,
  onDraftChange,
  onSendMessage,
  onBuzzMessage,
  tabs = [],
  activeTabId = null,
  onTabSelect,
  onClose,
  onMinimize,
  onMaximize,
  zIndex,
  onMouseDown,
  isActive = true,
  isMinimized = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState(getDefaultPosition);
  const [size, setSize] = useState(WINDOW_SIZE);
  const dragOffset = useRef({ x: 0, y: 0 });
  const originalPosition = useRef(getDefaultPosition());
  const originalSize = useRef(WINDOW_SIZE);

  const { startResize } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 320,
    minHeight: 520,
    isMaximized,
    onFocus: () => onMouseDown?.(windowId),
  });

  useEffect(() => {
    if (isMaximized) {
      originalPosition.current = position;
      originalSize.current = size;
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight - 30 });
    } else {
      setPosition(originalPosition.current);
      setSize(originalSize.current);
    }
  }, [isMaximized]);

  const handleMouseDown = (event) => {
    if (isMaximized || event.button !== 0) return;
    setIsDragging(true);
    dragOffset.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
    onMouseDown?.(windowId);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (event) => {
    if (!isDragging) return;
    setPosition({
      x: event.clientX - dragOffset.current.x,
      y: event.clientY - dragOffset.current.y,
    });
  };

  const toggleMaximize = () => {
    setIsMaximized((prev) => !prev);
    onMaximize?.(windowId);
  };

  useEffect(() => {
    if (!isDragging) return;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      className={`window yahoo-conversation-window${isActive ? "" : " is-inactive"}${
        isMaximized ? " maximized" : ""
      }`}
      style={{
        top: position.y,
        left: position.x,
        width: size.width,
        height: size.height,
        zIndex,
        display: isMinimized ? "none" : undefined,
      }}
      onMouseDown={() => onMouseDown?.(windowId)}
    >
      <div className="window-header" onMouseDown={handleMouseDown} onDoubleClick={toggleMaximize}>
        <div className="yahoo-conversation-titlebar">
          <div className="window-title">
            <img
              src={typingIcon}
              alt="Typing"
              className="window-title-icon yahoo-conversation-title-icon"
              draggable="false"
            />
            <span className="yahoo-conversation-title-text">{title}</span>
          </div>
          <div className="window-buttons">
            {onMinimize ? (
              <button className="window-btn minimize" onClick={() => onMinimize(windowId)}>
                <img src={minimizeIcon} alt="Minimize" />
              </button>
            ) : null}
            <button className="window-btn maximize" onClick={toggleMaximize}>
              <img src={maximizeIcon} alt="Maximize" />
            </button>
            <button className="window-btn close" onClick={() => onClose?.(windowId)}>
              <img src={closeIcon} alt="Close" />
            </button>
          </div>
        </div>
      </div>
      <div className="yahoo-conversation-body-wrapper">
        <YahooConversationWindowDesign
          contactName={contactName}
          contactImage={contactImage}
          username={username}
          messages={messages}
          draft={draft}
          statusMessage={statusMessage}
          statusType={statusType}
          onDraftChange={onDraftChange}
          onSendMessage={onSendMessage}
          onBuzzMessage={onBuzzMessage}
          tabs={tabs}
          activeTabId={activeTabId}
          onTabSelect={onTabSelect}
        />
      </div>
      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default YahooConversationWindow;
