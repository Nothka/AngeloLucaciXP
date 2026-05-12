import React, { useCallback, useEffect, useRef, useState } from "react";
import wordpadIcon from "../../../assets/icons/apps/wordpad.webp";
import minimizeIcon from "../../../assets/icons/ui/window-controls/Minimize.webp";
import maximizeIcon from "../../../assets/icons/ui/window-controls/Maximize.webp";
import closeIcon from "../../../assets/icons/ui/window-controls/Exit.webp";
import newActionIcon from "../../../assets/icons/actions/new.webp";
import openActionIcon from "../../../assets/icons/apps/Recent.webp";
import saveActionIcon from "../../../assets/icons/apps/Pdf.webp";
import printActionIcon from "../../../assets/icons/actions/send.webp";
import findActionIcon from "../../../assets/icons/apps/Search.webp";
import cutActionIcon from "../../../assets/icons/actions/Cut.webp";
import copyActionIcon from "../../../assets/icons/actions/Copy.webp";
import pasteActionIcon from "../../../assets/icons/actions/Paste.webp";
import undoActionIcon from "../../../assets/icons/ui/window-controls/Back.webp";
import redoActionIcon from "../../../assets/icons/ui/window-controls/Forward.webp";
import ResizeHandles from "../ResizeHandles";
import useWindowResize from "../hooks/useWindowResize";
import { getDesktopPoint } from "../utils/desktopTransform";
import "../../../styles/desktop/window.css";
import "../../../styles/desktop/apps/wordpad.css";

const DEFAULT_SIZE = { width: 740, height: 520 };
const DEFAULT_POSITION = { x: 140, y: 90 };
const DEFAULT_FILE_NAME = "Document";
const STORAGE_KEY = "xp_wordpad_docs_v1";

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

const WordPadWindow = ({
  windowId,
  zIndex,
  onClose,
  onMinimize,
  onMaximize,
  onMouseDown,
  isActive = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [menuOpen, setMenuOpen] = useState(null);
  const [showStandardToolbar, setShowStandardToolbar] = useState(true);
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(true);
  const [showRuler, setShowRuler] = useState(true);
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState("2");
  const [fileName, setFileName] = useState(DEFAULT_FILE_NAME);
  const [documentHtml, setDocumentHtml] = useState("<p></p>");
  const [savedHtml, setSavedHtml] = useState("<p></p>");
  const [documentVersion, setDocumentVersion] = useState(0);
  const windowRef = useRef(null);
  const editorRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const originalPosition = useRef(DEFAULT_POSITION);
  const originalSize = useRef(DEFAULT_SIZE);
  const { startResize } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 520,
    minHeight: 340,
    isMaximized,
    onFocus: () => onMouseDown(windowId),
  });

  const isDirty = documentHtml !== savedHtml;

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const syncDocumentFromEditor = () => {
    const current = editorRef.current;
    if (!current) return;
    setDocumentHtml(current.innerHTML);
  };

  const applyDocument = (name, html, forceDiscard = false) => {
    if (isDirty && !forceDiscard) {
      const proceed = window.confirm(
        "This WordPad document has changed.\n\nDiscard your changes and continue?"
      );
      if (!proceed) return false;
    }
    const nextName = name || DEFAULT_FILE_NAME;
    const nextHtml = html || "<p></p>";
    setFileName(nextName);
    setDocumentHtml(nextHtml);
    setSavedHtml(nextHtml);
    setDocumentVersion((prev) => prev + 1);
    requestAnimationFrame(() => {
      focusEditor();
    });
    return true;
  };

  const handleSaveAs = () => {
    const suggestion = fileName === DEFAULT_FILE_NAME ? "Document.rtf" : fileName;
    const rawName = window.prompt("Save As", suggestion);
    if (!rawName) return false;
    const trimmed = rawName.trim();
    if (!trimmed) return false;
    const finalName = /\.[a-z0-9]+$/i.test(trimmed) ? trimmed : `${trimmed}.rtf`;
    const files = readSavedFiles();
    const latestHtml = editorRef.current?.innerHTML ?? documentHtml;
    files[finalName] = latestHtml;
    writeSavedFiles(files);
    setFileName(finalName);
    setDocumentHtml(latestHtml);
    setSavedHtml(latestHtml);
    return true;
  };

  const handleSave = () => {
    if (fileName === DEFAULT_FILE_NAME) return handleSaveAs();
    const files = readSavedFiles();
    const latestHtml = editorRef.current?.innerHTML ?? documentHtml;
    files[fileName] = latestHtml;
    writeSavedFiles(files);
    setDocumentHtml(latestHtml);
    setSavedHtml(latestHtml);
    return true;
  };

  const handleOpen = () => {
    const files = readSavedFiles();
    const names = Object.keys(files).sort((a, b) => a.localeCompare(b));
    if (!names.length) {
      window.alert("No saved WordPad documents yet.");
      return;
    }
    const input = window.prompt(`Type a document name:\n\n${names.join("\n")}`, names[0]);
    if (!input) return;
    const query = input.trim().toLowerCase();
    const match = names.find((name) => name.toLowerCase() === query);
    if (!match) {
      window.alert(`Cannot find "${input.trim()}".`);
      return;
    }
    applyDocument(match, files[match]);
  };

  const handleNew = () => {
    applyDocument(DEFAULT_FILE_NAME, "<p></p>");
  };

  const handleCloseRequest = () => {
    if (isDirty) {
      const proceed = window.confirm(
        "The document has changed.\n\nDo you want to close and discard your changes?"
      );
      if (!proceed) return;
    }
    onClose(windowId);
  };

  const runEditorCommand = (command, value = null) => {
    focusEditor();
    document.execCommand(command, false, value);
    syncDocumentFromEditor();
  };

  const handleFind = () => {
    const query = window.prompt("Find what:");
    if (!query) return;
    const current = editorRef.current;
    if (!current) return;
    const haystack = current.innerText || "";
    const index = haystack.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0) {
      window.alert(`Cannot find "${query}".`);
      return;
    }
    current.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    const walker = document.createTreeWalker(current, NodeFilter.SHOW_TEXT);
    let traversed = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const next = traversed + node.textContent.length;
      if (index >= traversed && index < next) {
        const startOffset = index - traversed;
        const endOffset = Math.min(node.textContent.length, startOffset + query.length);
        range.setStart(node, startOffset);
        range.setEnd(node, endOffset);
        selection.removeAllRanges();
        selection.addRange(range);
        break;
      }
      traversed = next;
    }
  };

  const handleInsertDateTime = () => {
    const stamp = `${new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })} ${new Date().toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    })}`;
    runEditorCommand("insertText", stamp);
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

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback((event) => {
    if (!isDragging) return;
    const point = getDesktopPoint(event);
    setPosition({
      x: point.x - dragOffset.current.x,
      y: point.y - dragOffset.current.y,
    });
  }, [isDragging]);

  useEffect(() => {
    if (!isDragging) return;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp, isDragging]);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = documentHtml;
  }, [documentHtml, documentVersion]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!windowRef.current?.contains(event.target)) {
        setMenuOpen(null);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const executeMenuAction = (action) => {
    setMenuOpen(null);
    action?.();
  };

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
    if (cmdOrCtrl && key === "b") {
      event.preventDefault();
      runEditorCommand("bold");
      return;
    }
    if (cmdOrCtrl && key === "i") {
      event.preventDefault();
      runEditorCommand("italic");
      return;
    }
    if (cmdOrCtrl && key === "u") {
      event.preventDefault();
      runEditorCommand("underline");
      return;
    }
    if (cmdOrCtrl && key === "f") {
      event.preventDefault();
      handleFind();
      return;
    }
    if (event.key === "F5") {
      event.preventDefault();
      handleInsertDateTime();
      return;
    }
    if (event.key === "F1") {
      event.preventDefault();
      window.alert("WordPad\n\nFor Help, press F1.");
    }
  };

  const titleText = `${fileName} - WordPad`;

  return (
    <div
      className={`window wordpad-window ${isActive ? "" : "is-inactive"} ${isMaximized ? "maximized" : ""}`}
      ref={windowRef}
      style={{ top: position.y, left: position.x, zIndex, width: size.width, height: size.height }}
      onMouseDown={() => onMouseDown(windowId)}
    >
      <div className="window-header" onMouseDown={handleMouseDown} onDoubleClick={toggleMaximize}>
        <div className="window-title">
          <img src={wordpadIcon} alt="WordPad" className="window-title-icon" />
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

      <div className="window-menu-bar wordpad-menu-bar">
        <div className="wordpad-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn wordpad-menu-trigger ${menuOpen === "file" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "file" ? null : "file"))}
          >
            File
          </button>
          {menuOpen === "file" ? (
            <div className="wordpad-menu">
              <button type="button" className="wordpad-menu-item" onClick={() => executeMenuAction(handleNew)}>
                New
                <span className="wordpad-shortcut">Ctrl+N</span>
              </button>
              <button type="button" className="wordpad-menu-item" onClick={() => executeMenuAction(handleOpen)}>
                Open...
                <span className="wordpad-shortcut">Ctrl+O</span>
              </button>
              <button type="button" className="wordpad-menu-item" onClick={() => executeMenuAction(handleSave)}>
                Save
                <span className="wordpad-shortcut">Ctrl+S</span>
              </button>
              <button type="button" className="wordpad-menu-item" onClick={() => executeMenuAction(handleSaveAs)}>
                Save As...
              </button>
              <div className="wordpad-menu-divider" />
              <button type="button" className="wordpad-menu-item is-disabled" disabled>
                Print Preview
              </button>
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(() => window.print())}
              >
                Print...
              </button>
              <div className="wordpad-menu-divider" />
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(handleCloseRequest)}
              >
                Exit
              </button>
            </div>
          ) : null}
        </div>

        <div className="wordpad-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn wordpad-menu-trigger ${menuOpen === "edit" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "edit" ? null : "edit"))}
          >
            Edit
          </button>
          {menuOpen === "edit" ? (
            <div className="wordpad-menu">
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(() => runEditorCommand("undo"))}
              >
                Undo
                <span className="wordpad-shortcut">Ctrl+Z</span>
              </button>
              <div className="wordpad-menu-divider" />
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(() => runEditorCommand("cut"))}
              >
                Cut
                <span className="wordpad-shortcut">Ctrl+X</span>
              </button>
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(() => runEditorCommand("copy"))}
              >
                Copy
                <span className="wordpad-shortcut">Ctrl+C</span>
              </button>
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(() => runEditorCommand("paste"))}
              >
                Paste
                <span className="wordpad-shortcut">Ctrl+V</span>
              </button>
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(() => runEditorCommand("selectAll"))}
              >
                Select All
                <span className="wordpad-shortcut">Ctrl+A</span>
              </button>
              <div className="wordpad-menu-divider" />
              <button type="button" className="wordpad-menu-item" onClick={() => executeMenuAction(handleFind)}>
                Find...
                <span className="wordpad-shortcut">Ctrl+F</span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="wordpad-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn wordpad-menu-trigger ${menuOpen === "view" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "view" ? null : "view"))}
          >
            View
          </button>
          {menuOpen === "view" ? (
            <div className="wordpad-menu">
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(() => setShowStandardToolbar((prev) => !prev))}
              >
                {showStandardToolbar ? "✓ " : ""}
                Standard Toolbar
              </button>
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(() => setShowFormattingToolbar((prev) => !prev))}
              >
                {showFormattingToolbar ? "✓ " : ""}
                Formatting Toolbar
              </button>
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(() => setShowRuler((prev) => !prev))}
              >
                {showRuler ? "✓ " : ""}
                Ruler
              </button>
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(() => setShowStatusBar((prev) => !prev))}
              >
                {showStatusBar ? "✓ " : ""}
                Status Bar
              </button>
            </div>
          ) : null}
        </div>

        <div className="wordpad-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn wordpad-menu-trigger ${menuOpen === "insert" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "insert" ? null : "insert"))}
          >
            Insert
          </button>
          {menuOpen === "insert" ? (
            <div className="wordpad-menu">
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(handleInsertDateTime)}
              >
                Date and Time
                <span className="wordpad-shortcut">F5</span>
              </button>
              <button type="button" className="wordpad-menu-item is-disabled" disabled>
                Object...
              </button>
            </div>
          ) : null}
        </div>

        <div className="wordpad-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn wordpad-menu-trigger ${menuOpen === "format" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "format" ? null : "format"))}
          >
            Format
          </button>
          {menuOpen === "format" ? (
            <div className="wordpad-menu">
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(() => runEditorCommand("bold"))}
              >
                Bold
              </button>
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(() => runEditorCommand("italic"))}
              >
                Italic
              </button>
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() => executeMenuAction(() => runEditorCommand("underline"))}
              >
                Underline
              </button>
              <div className="wordpad-menu-divider" />
              <button type="button" className="wordpad-menu-item is-disabled" disabled>
                Paragraph...
              </button>
            </div>
          ) : null}
        </div>

        <div className="wordpad-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn wordpad-menu-trigger ${menuOpen === "help" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "help" ? null : "help"))}
          >
            Help
          </button>
          {menuOpen === "help" ? (
            <div className="wordpad-menu">
              <button
                type="button"
                className="wordpad-menu-item"
                onClick={() =>
                  executeMenuAction(() =>
                    window.alert("WordPad\n\nA basic rich text editor inspired by Windows XP.")
                  )
                }
              >
                About WordPad
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {showStandardToolbar ? (
        <div className="wordpad-toolbar wordpad-toolbar--standard">
          <button type="button" className="wordpad-toolbar-icon-btn" onClick={handleNew} title="New">
            <img src={newActionIcon} alt="" />
          </button>
          <button type="button" className="wordpad-toolbar-icon-btn" onClick={handleOpen} title="Open">
            <img src={openActionIcon} alt="" />
          </button>
          <button type="button" className="wordpad-toolbar-icon-btn" onClick={handleSave} title="Save">
            <img src={saveActionIcon} alt="" />
          </button>
          <span className="wordpad-toolbar-separator" />
          <button
            type="button"
            className="wordpad-toolbar-icon-btn"
            onClick={() => window.print()}
            title="Print"
          >
            <img src={printActionIcon} alt="" />
          </button>
          <button type="button" className="wordpad-toolbar-icon-btn" onClick={handleFind} title="Find">
            <img src={findActionIcon} alt="" />
          </button>
          <span className="wordpad-toolbar-separator" />
          <button type="button" className="wordpad-toolbar-icon-btn" onClick={() => runEditorCommand("cut")} title="Cut">
            <img src={cutActionIcon} alt="" />
          </button>
          <button type="button" className="wordpad-toolbar-icon-btn" onClick={() => runEditorCommand("copy")} title="Copy">
            <img src={copyActionIcon} alt="" />
          </button>
          <button type="button" className="wordpad-toolbar-icon-btn" onClick={() => runEditorCommand("paste")} title="Paste">
            <img src={pasteActionIcon} alt="" />
          </button>
          <span className="wordpad-toolbar-separator" />
          <button type="button" className="wordpad-toolbar-icon-btn" onClick={() => runEditorCommand("undo")} title="Undo">
            <img src={undoActionIcon} alt="" />
          </button>
          <button type="button" className="wordpad-toolbar-icon-btn" onClick={() => runEditorCommand("redo")} title="Redo">
            <img src={redoActionIcon} alt="" />
          </button>
        </div>
      ) : null}

      {showFormattingToolbar ? (
        <div className="wordpad-toolbar wordpad-toolbar--format">
          <select
            className="wordpad-select wordpad-select--font"
            value={fontFamily}
            onChange={(event) => {
              const next = event.target.value;
              setFontFamily(next);
              runEditorCommand("fontName", next);
            }}
          >
            <option value="Arial">Arial</option>
            <option value="Tahoma">Tahoma</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
          </select>
          <select
            className="wordpad-select wordpad-select--size"
            value={fontSize}
            onChange={(event) => {
              const next = event.target.value;
              setFontSize(next);
              runEditorCommand("fontSize", next);
            }}
          >
            <option value="1">8</option>
            <option value="2">10</option>
            <option value="3">12</option>
            <option value="4">14</option>
            <option value="5">18</option>
            <option value="6">24</option>
            <option value="7">36</option>
          </select>
          <select className="wordpad-select wordpad-select--script" defaultValue="Western">
            <option>Western</option>
          </select>
          <button type="button" className="wordpad-toolbar-btn is-bold" onClick={() => runEditorCommand("bold")}>
            B
          </button>
          <button type="button" className="wordpad-toolbar-btn is-italic" onClick={() => runEditorCommand("italic")}>
            I
          </button>
          <button type="button" className="wordpad-toolbar-btn is-underline" onClick={() => runEditorCommand("underline")}>
            U
          </button>
          <button
            type="button"
            className="wordpad-toolbar-btn"
            onClick={() => runEditorCommand("foreColor", "#1f5cc4")}
          >
            A
          </button>
          <button type="button" className="wordpad-toolbar-btn" onClick={() => runEditorCommand("justifyLeft")}>
            ≡
          </button>
          <button type="button" className="wordpad-toolbar-btn" onClick={() => runEditorCommand("justifyCenter")}>
            ≣
          </button>
          <button type="button" className="wordpad-toolbar-btn" onClick={() => runEditorCommand("justifyRight")}>
            ≡
          </button>
          <button type="button" className="wordpad-toolbar-btn" onClick={() => runEditorCommand("insertUnorderedList")}>
            •
          </button>
        </div>
      ) : null}

      {showRuler ? (
        <div className="wordpad-ruler">
          <div className="wordpad-ruler-start" />
          <div className="wordpad-ruler-track">
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
            <span>5</span>
          </div>
        </div>
      ) : null}

      <div className="wordpad-content" onMouseDown={focusEditor}>
        <div
          ref={editorRef}
          className="wordpad-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={syncDocumentFromEditor}
          onKeyDown={handleEditorKeyDown}
        />
      </div>

      {showStatusBar ? (
        <div className="wordpad-statusbar">
          <span>For Help, press F1</span>
        </div>
      ) : null}

      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default WordPadWindow;
