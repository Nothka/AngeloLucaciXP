import React, { useEffect, useMemo, useRef, useState } from "react";
import notepadIcon from "../../../assets/icons/apps/recentlyused/notepad.webp";
import minimizeIcon from "../../../assets/icons/ui/window-controls/Minimize.webp";
import maximizeIcon from "../../../assets/icons/ui/window-controls/Maximize.webp";
import closeIcon from "../../../assets/icons/ui/window-controls/Exit.webp";
import ResizeHandles from "../ResizeHandles";
import useWindowResize from "../hooks/useWindowResize";
import { getDesktopPoint } from "../utils/desktopTransform";
import "../../../styles/desktop/window.css";
import "../../../styles/desktop/apps/notepad.css";

const DEFAULT_SIZE = { width: 620, height: 460 };
const DEFAULT_POSITION = { x: 110, y: 90 };
const STORAGE_KEY = "xp_notepad_files_v1";
const DEFAULT_FILE_NAME = "Untitled";
const DEFAULT_FONT_FAMILY = '"Lucida Console", "Courier New", monospace';
const DEFAULT_FONT_SIZE = 14;
const INSERT_DATE_OPTIONS = { month: "2-digit", day: "2-digit", year: "numeric" };
const INSERT_TIME_OPTIONS = { hour: "numeric", minute: "2-digit", hour12: true };

const readSavedFiles = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeSavedFiles = (files) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
};

const getCurrentLineAndColumn = (text, cursorIndex) => {
  const safeIndex = Math.max(0, Math.min(cursorIndex, text.length));
  const beforeCursor = text.slice(0, safeIndex);
  const line = beforeCursor.split("\n").length;
  const lastBreak = beforeCursor.lastIndexOf("\n");
  const column = safeIndex - lastBreak;
  return { line, column };
};

const NotepadWindow = ({
  windowId,
  zIndex,
  onClose,
  onMinimize,
  onMaximize,
  onMouseDown,
  isActive = true,
  launchRequest,
  onOpenCommands,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [fileName, setFileName] = useState(DEFAULT_FILE_NAME);
  const [wordWrap, setWordWrap] = useState(false);
  const [statusBarVisible, setStatusBarVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(null);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT_FAMILY);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const windowRef = useRef(null);
  const textareaRef = useRef(null);
  const originalPosition = useRef(DEFAULT_POSITION);
  const originalSize = useRef(DEFAULT_SIZE);
  const dragOffset = useRef({ x: 0, y: 0 });
  const appliedLaunchIdRef = useRef(0);
  const { startResize } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 420,
    minHeight: 300,
    isMaximized,
    onFocus: () => onMouseDown(windowId),
  });

  const isDirty = text !== savedText;
  const canShowStatusBar = statusBarVisible && !wordWrap;
  const { line, column } = useMemo(
    () => getCurrentLineAndColumn(text, cursorIndex),
    [cursorIndex, text]
  );

  const focusEditor = () => {
    textareaRef.current?.focus();
  };

  const updateCursorIndex = () => {
    const current = textareaRef.current;
    if (!current) return;
    setCursorIndex(current.selectionStart ?? 0);
  };

  const applyDocument = (documentPayload, forceDiscard = false) => {
    if (isDirty && !forceDiscard) {
      const proceed = window.confirm(
        "This text has changed.\n\nDo you want to discard your changes and continue?"
      );
      if (!proceed) return false;
    }
    const nextFileName = documentPayload?.name || DEFAULT_FILE_NAME;
    const nextContent = documentPayload?.content || "";
    setFileName(nextFileName);
    setText(nextContent);
    setSavedText(nextContent);
    setCursorIndex(0);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(0, 0);
    });
    return true;
  };

  const handleSaveAs = () => {
    const currentSuggestion =
      fileName === DEFAULT_FILE_NAME ? "Untitled.txt" : fileName;
    const rawName = window.prompt("Save As", currentSuggestion);
    if (!rawName) return false;
    const trimmed = rawName.trim();
    if (!trimmed) return false;
    const finalName = /\.[a-z0-9]+$/i.test(trimmed) ? trimmed : `${trimmed}.txt`;
    const files = readSavedFiles();
    files[finalName] = text;
    writeSavedFiles(files);
    setFileName(finalName);
    setSavedText(text);
    return true;
  };

  const handleSave = () => {
    if (fileName === DEFAULT_FILE_NAME) {
      return handleSaveAs();
    }
    const files = readSavedFiles();
    files[fileName] = text;
    writeSavedFiles(files);
    setSavedText(text);
    return true;
  };

  const handleOpen = () => {
    const files = readSavedFiles();
    const names = Object.keys(files).sort((a, b) => a.localeCompare(b));
    if (!names.length) {
      window.alert("No saved Notepad files yet.");
      return;
    }
    const input = window.prompt(`Type a file name to open:\n\n${names.join("\n")}`, names[0]);
    if (!input) return;
    const requested = input.trim();
    if (!requested) return;
    const match = names.find((name) => name.toLowerCase() === requested.toLowerCase());
    if (!match) {
      window.alert(`Cannot find "${requested}".`);
      return;
    }
    applyDocument({ name: match, content: files[match] });
  };

  const handleNew = () => {
    applyDocument({ name: DEFAULT_FILE_NAME, content: "" });
  };

  const handleInsertTimeDate = () => {
    const area = textareaRef.current;
    if (!area) return;
    const stamp = `${new Date().toLocaleTimeString("en-US", INSERT_TIME_OPTIONS)} ${new Date().toLocaleDateString("en-US", INSERT_DATE_OPTIONS)}`;
    const selectionStart = area.selectionStart ?? text.length;
    const selectionEnd = area.selectionEnd ?? text.length;
    const nextText = `${text.slice(0, selectionStart)}${stamp}${text.slice(selectionEnd)}`;
    const nextCursor = selectionStart + stamp.length;
    setText(nextText);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(nextCursor, nextCursor);
      setCursorIndex(nextCursor);
    });
  };

  const handleFind = () => {
    const query = window.prompt("Find what:");
    if (!query) return;
    const area = textareaRef.current;
    const start = area?.selectionEnd ?? 0;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let index = lowerText.indexOf(lowerQuery, start);
    if (index < 0) {
      index = lowerText.indexOf(lowerQuery, 0);
    }
    if (index < 0) {
      window.alert(`Cannot find "${query}".`);
      return;
    }
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(index, index + query.length);
      setCursorIndex(index + query.length);
    });
  };

  const handleCloseRequest = () => {
    if (isDirty) {
      const proceed = window.confirm(
        "The text in this document has changed.\n\nDo you want to close and discard your changes?"
      );
      if (!proceed) return;
    }
    onClose(windowId);
  };

  const handleMouseDown = (event) => {
    if (isMaximized || event.button !== 0) return;
    setIsDragging(true);
    const point = getDesktopPoint(event);
    dragOffset.current = {
      x: point.x - position.x,
      y: point.y - position.y,
    };
    onMouseDown(windowId);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (event) => {
    if (!isDragging) return;
    const point = getDesktopPoint(event);
    setPosition({
      x: point.x - dragOffset.current.x,
      y: point.y - dragOffset.current.y,
    });
  };

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

  useEffect(() => {
    if (!isDragging) return;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (!windowRef.current?.contains(event.target)) {
        setMenuOpen(null);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!launchRequest?.id) return;
    if (launchRequest.id === appliedLaunchIdRef.current) return;
    const timeoutId = window.setTimeout(() => {
      appliedLaunchIdRef.current = launchRequest.id;
      if (launchRequest.document) {
        applyDocument(launchRequest.document, launchRequest.forceDiscard);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [launchRequest]);

  const handleEditorKeyDown = (event) => {
    const key = event.key.toLowerCase();
    const cmdOrCtrl = event.metaKey || event.ctrlKey;
    if (cmdOrCtrl && key === "s") {
      event.preventDefault();
      handleSave();
      return;
    }
    if (cmdOrCtrl && key === "o") {
      event.preventDefault();
      handleOpen();
      return;
    }
    if (cmdOrCtrl && key === "n") {
      event.preventDefault();
      handleNew();
      return;
    }
    if (cmdOrCtrl && key === "f") {
      event.preventDefault();
      handleFind();
      return;
    }
    if (event.key === "F5") {
      event.preventDefault();
      handleInsertTimeDate();
    }
  };

  const executeMenuAction = (action) => {
    setMenuOpen(null);
    action?.();
  };

  const fontLabel = `${Math.round(fontSize)}px`;
  const titleText = `${fileName} - Notepad`;

  return (
    <div
      className={`window notepad-window ${isActive ? "" : "is-inactive"} ${isMaximized ? "maximized" : ""}`}
      ref={windowRef}
      style={{ top: position.y, left: position.x, zIndex, width: size.width, height: size.height }}
      onMouseDown={() => onMouseDown(windowId)}
    >
      <div className="window-header" onMouseDown={handleMouseDown} onDoubleClick={toggleMaximize}>
        <div className="window-title">
          <img src={notepadIcon} alt="Notepad" className="window-title-icon" />
          <span>{titleText}</span>
        </div>
        <div className="window-buttons">
          <button className="window-btn minimize" onClick={() => onMinimize(windowId)}>
            <img src={minimizeIcon} alt="Minimize" />
          </button>
          <button className="window-btn maximize" onClick={toggleMaximize}>
            <img src={maximizeIcon} alt="Maximize" />
          </button>
          <button className="window-btn close" onClick={handleCloseRequest}>
            <img src={closeIcon} alt="Close" />
          </button>
        </div>
      </div>

      <div className="window-menu-bar notepad-menu-bar">
        <div className="notepad-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn notepad-menu-trigger ${menuOpen === "file" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "file" ? null : "file"))}
          >
            File
          </button>
          {menuOpen === "file" ? (
            <div className="notepad-menu">
              <button type="button" className="notepad-menu-item" onClick={() => executeMenuAction(handleNew)}>
                New
                <span className="notepad-shortcut">Ctrl+N</span>
              </button>
              <button type="button" className="notepad-menu-item" onClick={() => executeMenuAction(handleOpen)}>
                Open...
                <span className="notepad-shortcut">Ctrl+O</span>
              </button>
              <button type="button" className="notepad-menu-item" onClick={() => executeMenuAction(handleSave)}>
                Save
                <span className="notepad-shortcut">Ctrl+S</span>
              </button>
              <button type="button" className="notepad-menu-item" onClick={() => executeMenuAction(handleSaveAs)}>
                Save As...
              </button>
              <div className="notepad-menu-divider" />
              <button
                type="button"
                className="notepad-menu-item"
                onClick={() => executeMenuAction(() => window.print())}
              >
                Print...
                <span className="notepad-shortcut">Ctrl+P</span>
              </button>
              <div className="notepad-menu-divider" />
              <button type="button" className="notepad-menu-item" onClick={() => executeMenuAction(handleCloseRequest)}>
                Exit
              </button>
            </div>
          ) : null}
        </div>

        <div className="notepad-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn notepad-menu-trigger ${menuOpen === "edit" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "edit" ? null : "edit"))}
          >
            Edit
          </button>
          {menuOpen === "edit" ? (
            <div className="notepad-menu">
              <button
                type="button"
                className="notepad-menu-item"
                onClick={() => executeMenuAction(() => document.execCommand("undo"))}
              >
                Undo
                <span className="notepad-shortcut">Ctrl+Z</span>
              </button>
              <div className="notepad-menu-divider" />
              <button
                type="button"
                className="notepad-menu-item"
                onClick={() => executeMenuAction(() => document.execCommand("cut"))}
              >
                Cut
                <span className="notepad-shortcut">Ctrl+X</span>
              </button>
              <button
                type="button"
                className="notepad-menu-item"
                onClick={() => executeMenuAction(() => document.execCommand("copy"))}
              >
                Copy
                <span className="notepad-shortcut">Ctrl+C</span>
              </button>
              <button
                type="button"
                className="notepad-menu-item"
                onClick={() => executeMenuAction(() => document.execCommand("paste"))}
              >
                Paste
                <span className="notepad-shortcut">Ctrl+V</span>
              </button>
              <button
                type="button"
                className="notepad-menu-item"
                onClick={() => executeMenuAction(() => document.execCommand("delete"))}
              >
                Delete
                <span className="notepad-shortcut">Del</span>
              </button>
              <div className="notepad-menu-divider" />
              <button type="button" className="notepad-menu-item" onClick={() => executeMenuAction(handleFind)}>
                Find...
                <span className="notepad-shortcut">Ctrl+F</span>
              </button>
              <button
                type="button"
                className="notepad-menu-item"
                onClick={() => executeMenuAction(() => document.execCommand("selectAll"))}
              >
                Select All
                <span className="notepad-shortcut">Ctrl+A</span>
              </button>
              <button
                type="button"
                className="notepad-menu-item"
                onClick={() => executeMenuAction(handleInsertTimeDate)}
              >
                Time/Date
                <span className="notepad-shortcut">F5</span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="notepad-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn notepad-menu-trigger ${menuOpen === "format" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "format" ? null : "format"))}
          >
            Format
          </button>
          {menuOpen === "format" ? (
            <div className="notepad-menu">
              <button
                type="button"
                className="notepad-menu-item"
                onClick={() =>
                  executeMenuAction(() => {
                    setWordWrap((prev) => !prev);
                  })
                }
              >
                {wordWrap ? "✓ " : ""}
                Word Wrap
              </button>
              <div className="notepad-menu-divider" />
              <button
                type="button"
                className="notepad-menu-item"
                onClick={() =>
                  executeMenuAction(() => {
                    setFontSize((prev) => (prev >= 20 ? 12 : prev + 1));
                  })
                }
              >
                Font Size
                <span className="notepad-shortcut">{fontLabel}</span>
              </button>
              <button
                type="button"
                className="notepad-menu-item"
                onClick={() =>
                  executeMenuAction(() => {
                    setFontFamily((prev) =>
                      prev === DEFAULT_FONT_FAMILY ? '"Tahoma", sans-serif' : DEFAULT_FONT_FAMILY
                    );
                  })
                }
              >
                Toggle Font
              </button>
            </div>
          ) : null}
        </div>

        <div className="notepad-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn notepad-menu-trigger ${menuOpen === "view" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "view" ? null : "view"))}
          >
            View
          </button>
          {menuOpen === "view" ? (
            <div className="notepad-menu">
              <button
                type="button"
                className={`notepad-menu-item ${wordWrap ? "is-disabled" : ""}`}
                disabled={wordWrap}
                onClick={() =>
                  executeMenuAction(() => {
                    setStatusBarVisible((prev) => !prev);
                  })
                }
              >
                {statusBarVisible ? "✓ " : ""}
                Status Bar
              </button>
            </div>
          ) : null}
        </div>

        <div className="notepad-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn notepad-menu-trigger ${menuOpen === "help" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "help" ? null : "help"))}
          >
            Help
          </button>
          {menuOpen === "help" ? (
            <div className="notepad-menu">
              <button type="button" className="notepad-menu-item" onClick={() => executeMenuAction(onOpenCommands)}>
                View Run Commands
              </button>
              <div className="notepad-menu-divider" />
              <button
                type="button"
                className="notepad-menu-item"
                onClick={() =>
                  executeMenuAction(() =>
                    window.alert("Notepad\n\nA simple text editor inspired by Windows XP.")
                  )
                }
              >
                About Notepad
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="notepad-content" onMouseDown={focusEditor}>
        <textarea
          ref={textareaRef}
          className="notepad-editor"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleEditorKeyDown}
          onClick={updateCursorIndex}
          onKeyUp={updateCursorIndex}
          onSelect={updateCursorIndex}
          wrap={wordWrap ? "soft" : "off"}
          style={{
            whiteSpace: wordWrap ? "pre-wrap" : "pre",
            overflowX: wordWrap ? "hidden" : "auto",
            fontFamily,
            fontSize: `${fontSize}px`,
          }}
          spellCheck={false}
        />
      </div>

      {canShowStatusBar ? (
        <div className="notepad-statusbar">
          <span>{`Ln ${line}, Col ${column}`}</span>
        </div>
      ) : null}

      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default NotepadWindow;
