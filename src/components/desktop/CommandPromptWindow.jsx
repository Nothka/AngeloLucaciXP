import React, { useState, useRef, useEffect } from "react";
import commandpromptIcon from "../../assets/startmenu/commandprompt.png";
import minimizeIcon from "../../assets/window/Minimize.png";
import maximizeIcon from "../../assets/window/Maximize.png";
import closeIcon from "../../assets/window/Exit.png";
import ResizeHandles from "./ResizeHandles";
import useWindowResize from "./hooks/useWindowResize";
import { getDesktopPoint } from "./utils/desktopTransform";
import "../../styles/desktop/window.css"; // Import generic window styles
import "../../styles/desktop/apps/commandprompt.css";

const CommandPromptWindow = ({
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
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 640, height: 400 });
  const [lines, setLines] = useState([
    "Microsoft Windows XP [Version 5.1.2600]",
    "(C) Copyright 1985-2001 Microsoft Corp.",
    "",
  ]);
  const [input, setInput] = useState("");
  const windowRef = useRef(null);
  const inputRef = useRef(null);
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

  const dragOffset = useRef({ x: 0, y: 0 });
  const originalPosition = useRef({ x: 100, y: 100 });
  const originalSize = useRef({ width: 640, height: 400 });


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
    if (isMaximized || e.button !== 0) return;

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

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (onMaximize) onMaximize(windowId);
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

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter") {
      const newLines = [...lines, `C:\\> ${input}`];
      // Process command
      const command = input.toLowerCase().trim();
      if (command === "help") {
        newLines.push("Available commands: help, cls, exit");
      } else if (command === "cls") {
        setLines([]);
        setInput("");
        return;
      } else if (command === "exit") {
        onClose(windowId);
        return;
      } else if (command) {
        newLines.push(`'${command}' is not recognized as an internal or external command,`);
        newLines.push("operable program or batch file.");
      }
      setLines(newLines);
      setInput("");
    }
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div
      className={`window command-prompt-window ${isActive ? "" : "is-inactive"} ${isMaximized ? "maximized" : ""}`}
      ref={windowRef}
      style={{ top: position.y, left: position.x, zIndex, width: size.width, height: size.height }}
      onMouseDown={() => onMouseDown(windowId)}
    >
      <div className="window-header" onMouseDown={handleMouseDown} onDoubleClick={toggleMaximize}>
        <div className="window-title">
          <img src={commandpromptIcon} alt="Command Prompt" className="window-title-icon" />
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
      <div className="window-content" onClick={() => inputRef.current.focus()}>
        {lines.map((line, index) => (
          <div key={index}>{line}</div>
        ))}
        <div className="command-input">
          <span>C:\&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            autoFocus
          />
        </div>
      </div>
      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default CommandPromptWindow;
