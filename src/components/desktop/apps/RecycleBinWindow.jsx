import React, { useCallback, useEffect, useRef, useState } from "react";
import recycleBinEmptyIcon from "../../../assets/icons/apps/recycle-bin/recycle-bin-empty.webp";
import recycleBinFullIcon from "../../../assets/icons/apps/recycle-bin/recycle-bin-full.webp";
import desktopIcon from "../../../assets/icons/apps/recycle-bin/desktop.webp";
import restoreAllItemsIcon from "../../../assets/icons/apps/recycle-bin/restore-all-items.webp";
import myDocumentsIcon from "../../../assets/icons/apps/recycle-bin/my-documents.webp";
import upIcon from "../../../assets/icons/apps/recycle-bin/up.webp";
import arrowIcon from "../../../assets/icons/skills/arrow.webp";
import backIcon from "../../../assets/icons/ui/window-controls/Back.webp";
import forwardIcon from "../../../assets/icons/ui/window-controls/Forward.webp";
import favoritesIcon from "../../../assets/icons/ui/window-controls/Favorites.webp";
import searchIcon from "../../../assets/icons/apps/Search.webp";
import contactIcon from "../../../assets/icons/apps/contact.webp";
import minimizeIcon from "../../../assets/icons/ui/window-controls/Minimize.webp";
import maximizeIcon from "../../../assets/icons/ui/window-controls/Maximize.webp";
import closeIcon from "../../../assets/icons/ui/window-controls/Exit.webp";
import ResizeHandles from "../ResizeHandles";
import useWindowResize from "../hooks/useWindowResize";
import { getDesktopPoint } from "../utils/desktopTransform";
import "../../../styles/desktop/window.css";
import "../../../styles/desktop/apps/recycle-bin.css";

const DEFAULT_SIZE = { width: 760, height: 500 };
const DEFAULT_POSITION = { x: 120, y: 70 };
const SIZE_PRESETS_KB = [4, 12, 24, 48, 128, 208, 276];

const formatDeletedTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getRecycleItemMeta = (item) => {
  if (!item) return { type: "Shortcut", size: "4 KB" };
  const label = `${item.label || ""}`.toLowerCase();
  if (label.includes("project")) {
    return { type: "File Folder", size: "208 KB" };
  }
  if (label.includes("resume")) {
    return { type: "Rich Text Document", size: "276 KB" };
  }
  if (label.includes("readme") || label.includes("read me")) {
    return { type: "Shortcut", size: "4 KB" };
  }
  const seed = [...`${item.id || item.label || ""}`].reduce((total, char) => total + char.charCodeAt(0), 0);
  const kb = SIZE_PRESETS_KB[seed % SIZE_PRESETS_KB.length];
  return { type: "Shortcut", size: `${kb} KB` };
};

const RecycleBinWindow = ({
  windowId,
  zIndex,
  onClose,
  onMinimize,
  onMaximize,
  onMouseDown,
  isActive = true,
  items = [],
  onRestoreItem,
  onEmptyBin,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [menuOpen, setMenuOpen] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [panelOpen, setPanelOpen] = useState({
    tasks: true,
    places: true,
    details: false,
  });
  const windowRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const originalPosition = useRef(DEFAULT_POSITION);
  const originalSize = useRef(DEFAULT_SIZE);
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

  const effectiveSelectedId = items.some((item) => item.id === selectedId) ? selectedId : null;
  const selectedItem = items.find((item) => item.id === effectiveSelectedId) || null;

  const handleCloseRequest = () => {
    onClose(windowId);
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

  const handleMouseMove = useCallback(
    (event) => {
      if (!isDragging) return;
      const point = getDesktopPoint(event);
      setPosition({
        x: point.x - dragOffset.current.x,
        y: point.y - dragOffset.current.y,
      });
    },
    [isDragging]
  );

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

  const togglePanel = (panelKey) => {
    setPanelOpen((previous) => ({
      ...previous,
      [panelKey]: !previous[panelKey],
    }));
  };

  const restoreAll = () => {
    if (!items.length) return;
    const ids = items.map((item) => item.id);
    ids.forEach((id) => onRestoreItem?.(id));
    setSelectedId(null);
  };

  const emptyBin = () => {
    if (!items.length) return;
    const proceed = window.confirm("Empty all items in Recycle Bin?");
    if (!proceed) return;
    onEmptyBin?.();
    setSelectedId(null);
  };

  const iconForTitle = items.length ? recycleBinFullIcon : recycleBinEmptyIcon;

  return (
    <div
      className={`window recycle-bin-window ${isActive ? "" : "is-inactive"} ${isMaximized ? "maximized" : ""}`}
      ref={windowRef}
      style={{ top: position.y, left: position.x, zIndex, width: size.width, height: size.height }}
      onMouseDown={() => onMouseDown(windowId)}
    >
      <div className="window-header" onMouseDown={handleMouseDown} onDoubleClick={toggleMaximize}>
        <div className="window-title">
          <img src={iconForTitle} alt="Recycle Bin" className="window-title-icon" />
          <span>Recycle Bin</span>
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

      <div className="window-menu-bar recycle-bin-menu-bar">
        <div className="recycle-bin-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn recycle-bin-menu-trigger ${menuOpen === "file" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "file" ? null : "file"))}
          >
            File
          </button>
          {menuOpen === "file" ? (
            <div className="recycle-bin-menu">
              <button type="button" className="recycle-bin-menu-item" onClick={() => executeMenuAction(emptyBin)}>
                Empty Recycle Bin
              </button>
              <div className="recycle-bin-menu-divider" />
              <button type="button" className="recycle-bin-menu-item is-disabled" disabled>
                Create Shortcut
              </button>
              <button type="button" className="recycle-bin-menu-item is-disabled" disabled>
                Delete
              </button>
              <button type="button" className="recycle-bin-menu-item is-disabled" disabled>
                Rename
              </button>
              <button type="button" className="recycle-bin-menu-item is-disabled" disabled>
                Properties
              </button>
              <div className="recycle-bin-menu-divider" />
              <button
                type="button"
                className="recycle-bin-menu-item"
                onClick={() => executeMenuAction(handleCloseRequest)}
              >
                Close
              </button>
            </div>
          ) : null}
        </div>

        <div className="recycle-bin-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn recycle-bin-menu-trigger ${menuOpen === "edit" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "edit" ? null : "edit"))}
          >
            Edit
          </button>
          {menuOpen === "edit" ? (
            <div className="recycle-bin-menu">
              <button type="button" className="recycle-bin-menu-item is-disabled" disabled>
                Undo
              </button>
              <button type="button" className="recycle-bin-menu-item is-disabled" disabled>
                Cut
              </button>
              <button type="button" className="recycle-bin-menu-item is-disabled" disabled>
                Copy
              </button>
              <button type="button" className="recycle-bin-menu-item is-disabled" disabled>
                Paste
              </button>
            </div>
          ) : null}
        </div>

        <div className="recycle-bin-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn recycle-bin-menu-trigger ${menuOpen === "view" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "view" ? null : "view"))}
          >
            View
          </button>
          {menuOpen === "view" ? (
            <div className="recycle-bin-menu">
              <button type="button" className="recycle-bin-menu-item is-disabled" disabled>
                Large Icons
              </button>
              <button type="button" className="recycle-bin-menu-item is-disabled" disabled>
                Details
              </button>
            </div>
          ) : null}
        </div>

        <div className="recycle-bin-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn recycle-bin-menu-trigger ${menuOpen === "favorites" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "favorites" ? null : "favorites"))}
          >
            Favorites
          </button>
          {menuOpen === "favorites" ? (
            <div className="recycle-bin-menu">
              <button type="button" className="recycle-bin-menu-item is-disabled" disabled>
                Add to Favorites
              </button>
            </div>
          ) : null}
        </div>

        <div className="recycle-bin-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn recycle-bin-menu-trigger ${menuOpen === "tools" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "tools" ? null : "tools"))}
          >
            Tools
          </button>
          {menuOpen === "tools" ? (
            <div className="recycle-bin-menu">
              <button type="button" className="recycle-bin-menu-item is-disabled" disabled>
                Folder Options...
              </button>
            </div>
          ) : null}
        </div>

        <div className="recycle-bin-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn recycle-bin-menu-trigger ${menuOpen === "help" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "help" ? null : "help"))}
          >
            Help
          </button>
          {menuOpen === "help" ? (
            <div className="recycle-bin-menu">
              <button
                type="button"
                className="recycle-bin-menu-item"
                onClick={() =>
                  executeMenuAction(() =>
                    window.alert("Recycle Bin\n\nDrag desktop icons here to remove them from desktop.")
                  )
                }
              >
                About Recycle Bin
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="recycle-bin-toolbar">
        <button type="button" className="recycle-bin-nav-btn is-disabled" disabled>
          <img src={backIcon} alt="" />
          Back
        </button>
        <button type="button" className="recycle-bin-nav-btn is-disabled" disabled>
          <img src={forwardIcon} alt="" />
          Forward
        </button>
        <div className="recycle-bin-toolbar-divider" />
        <button type="button" className="recycle-bin-nav-btn is-disabled" disabled>
          <img src={upIcon} alt="" />
          Up
        </button>
        <button type="button" className="recycle-bin-nav-btn is-disabled" disabled>
          <img src={searchIcon} alt="" />
          Search
        </button>
        <button type="button" className="recycle-bin-nav-btn is-disabled" disabled>
          <img src={myDocumentsIcon} alt="" />
          Folders
        </button>
        <button type="button" className="recycle-bin-nav-btn recycle-bin-view-btn is-disabled" disabled>
          <img src={favoritesIcon} alt="" />
          <span aria-hidden="true">▼</span>
        </button>
      </div>

      <div className="window-address recycle-bin-address">
        <span className="address-label">Address</span>
        <div className="address-bar">
          <img src={iconForTitle} alt="" />
          <span className="address-bar-text">Recycle Bin</span>
        </div>
      </div>

      <div className="recycle-bin-content">
        <aside className="recycle-bin-sidebar">
          <section className={`recycle-bin-side-section ${panelOpen.tasks ? "" : "is-collapsed"}`}>
            <header className="recycle-bin-side-title">
              <span>Recycle Bin Tasks</span>
              <button
                type="button"
                className={`recycle-bin-section-toggle ${panelOpen.tasks ? "" : "is-collapsed"}`}
                onClick={() => togglePanel("tasks")}
                aria-label={panelOpen.tasks ? "Collapse Recycle Bin Tasks" : "Expand Recycle Bin Tasks"}
                aria-expanded={panelOpen.tasks}
              >
                <img src={arrowIcon} alt="" aria-hidden="true" />
              </button>
            </header>
            {panelOpen.tasks ? (
              <div className="recycle-bin-side-body">
                <button type="button" className="recycle-bin-side-link" onClick={emptyBin} disabled={!items.length}>
                  <img src={iconForTitle} alt="" />
                  <span>Empty the Recycle Bin</span>
                </button>
                <button type="button" className="recycle-bin-side-link" onClick={restoreAll} disabled={!items.length}>
                  <img src={restoreAllItemsIcon} alt="" />
                  <span>Restore all items</span>
                </button>
              </div>
            ) : null}
          </section>
          <section className={`recycle-bin-side-section ${panelOpen.places ? "" : "is-collapsed"}`}>
            <header className="recycle-bin-side-title">
              <span>Other Places</span>
              <button
                type="button"
                className={`recycle-bin-section-toggle ${panelOpen.places ? "" : "is-collapsed"}`}
                onClick={() => togglePanel("places")}
                aria-label={panelOpen.places ? "Collapse Other Places" : "Expand Other Places"}
                aria-expanded={panelOpen.places}
              >
                <img src={arrowIcon} alt="" aria-hidden="true" />
              </button>
            </header>
            {panelOpen.places ? (
              <div className="recycle-bin-side-body recycle-bin-other-places">
              <button type="button" className="recycle-bin-side-link is-static">
                <img src={desktopIcon} alt="" />
                <span>Desktop</span>
              </button>
                <button type="button" className="recycle-bin-side-link is-static">
                  <img src={myDocumentsIcon} alt="" />
                  <span>My Documents</span>
                </button>
                <button type="button" className="recycle-bin-side-link is-static">
                  <img src={contactIcon} alt="" />
                  <span>My Computer</span>
                </button>
                <button type="button" className="recycle-bin-side-link is-static">
                  <img src={favoritesIcon} alt="" />
                  <span>My Network Places</span>
                </button>
              </div>
            ) : null}
          </section>
          <section
            className={`recycle-bin-side-section recycle-bin-details-section ${panelOpen.details ? "" : "is-collapsed"}`}
          >
            <header className="recycle-bin-side-title">
              <span>Details</span>
              <button
                type="button"
                className={`recycle-bin-section-toggle ${panelOpen.details ? "" : "is-collapsed"}`}
                onClick={() => togglePanel("details")}
                aria-label={panelOpen.details ? "Collapse Details" : "Expand Details"}
                aria-expanded={panelOpen.details}
              >
                <img src={arrowIcon} alt="" aria-hidden="true" />
              </button>
            </header>
            {panelOpen.details ? (
              <div className="recycle-bin-side-body recycle-bin-details">
                <strong>{selectedItem ? selectedItem.label : ""}</strong>
                <span>
                  {selectedItem ? `Deleted ${formatDeletedTime(selectedItem.deletedAt)}` : ""}
                </span>
              </div>
            ) : null}
          </section>
        </aside>

        <div className="recycle-bin-main">
          <div className="recycle-bin-list">
            {items.length ? (
              <div className="recycle-bin-items-grid">
                {items.map((item) => (
                  (() => {
                    const meta = getRecycleItemMeta(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`recycle-bin-row ${effectiveSelectedId === item.id ? "is-selected" : ""}`}
                        onClick={() => setSelectedId(item.id)}
                        onDoubleClick={() => {
                          onRestoreItem?.(item.id);
                          setSelectedId(null);
                        }}
                      >
                        <img src={item.icon} alt="" />
                        <div className="recycle-bin-row-copy">
                          <span className="recycle-bin-row-label">{item.label}</span>
                          <span className="recycle-bin-row-type">{meta.type}</span>
                          <span className="recycle-bin-row-size">{meta.size}</span>
                        </div>
                      </button>
                    );
                  })()
                ))}
              </div>
            ) : (
              <p className="recycle-bin-empty"></p>
            )}
          </div>
        </div>
      </div>

      <div className="recycle-bin-statusbar">
        <span>{items.length ? `${items.length} item(s)` : "0 items"}</span>
        <span>{effectiveSelectedId ? "1 selected" : ""}</span>
      </div>

      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default RecycleBinWindow;
