import React, { useEffect, useMemo, useRef, useState } from "react";
import minimizeIcon from "../../../../assets/yahoo/header/window-minimize.png";
import maximizeIcon from "../../../../assets/yahoo/header/maximise.png";
import closeIcon from "../../../../assets/yahoo/header/close.png";
import ResizeHandles from "../../ResizeHandles";
import useWindowResize from "../../hooks/useWindowResize";
import { getDesktopPoint } from "../../utils/desktopTransform";
import "../../../../styles/desktop/window.css";
import "../../../../styles/desktop/apps/yahoo/yahoo.css";
import "../../../../styles/desktop/apps/yahoo/yahoo-privacy-options.css";

const WINDOW_SIZE = { width: 500, height: 460 };

const getDefaultPosition = () => {
  if (typeof window === "undefined") return { x: 300, y: 130 };
  return {
    x: Math.max(80, Math.round((window.innerWidth - WINDOW_SIZE.width) / 2)),
    y: Math.max(80, Math.round((window.innerHeight - WINDOW_SIZE.height - 30) / 2)),
  };
};

const arraysEqual = (left = [], right = []) => {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
};

const YahooPrivacyOptionsWindow = ({
  windowId = "yahoo-privacy-options-window",
  onClose,
  onMinimize,
  onMaximize,
  zIndex,
  onMouseDown,
  isActive = true,
  isMinimized = false,
  initialPresence = "online",
  noIncomingCalls = false,
  allowOnlyContacts = false,
  showYahooSites = true,
  ignoredUsers = [],
  onApply,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState(getDefaultPosition);
  const [size, setSize] = useState(WINDOW_SIZE);

  const [allowOnlyContactsDraft, setAllowOnlyContactsDraft] = useState(allowOnlyContacts);
  const [showYahooSitesDraft, setShowYahooSitesDraft] = useState(showYahooSites);
  const [invisibleDraft, setInvisibleDraft] = useState(initialPresence === "invisible");
  const [noIncomingCallsDraft, setNoIncomingCallsDraft] = useState(noIncomingCalls);
  const [ignoredUsersDraft, setIgnoredUsersDraft] = useState(() => [...ignoredUsers]);
  const [selectedIgnoredIndex, setSelectedIgnoredIndex] = useState(-1);
  const [newIgnoredUser, setNewIgnoredUser] = useState("");

  const dragOffset = useRef({ x: 0, y: 0 });
  const originalPosition = useRef(getDefaultPosition());
  const originalSize = useRef(WINDOW_SIZE);

  const { startResize } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 430,
    minHeight: 380,
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
    const point = getDesktopPoint(event);
    dragOffset.current = {
      x: point.x - position.x,
      y: point.y - position.y,
    };
    onMouseDown?.(windowId);
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

  const hasChanges = useMemo(() => {
    const baseInvisible = initialPresence === "invisible";
    return (
      allowOnlyContactsDraft !== allowOnlyContacts ||
      showYahooSitesDraft !== showYahooSites ||
      invisibleDraft !== baseInvisible ||
      noIncomingCallsDraft !== noIncomingCalls ||
      !arraysEqual(ignoredUsersDraft, ignoredUsers)
    );
  }, [
    allowOnlyContacts,
    allowOnlyContactsDraft,
    ignoredUsers,
    ignoredUsersDraft,
    initialPresence,
    invisibleDraft,
    noIncomingCalls,
    noIncomingCallsDraft,
    showYahooSites,
    showYahooSitesDraft,
  ]);

  const applyChanges = () => {
    onApply?.({
      isInvisible: invisibleDraft,
      noIncomingCalls: noIncomingCallsDraft,
      allowOnlyContacts: allowOnlyContactsDraft,
      showYahooSites: showYahooSitesDraft,
      ignoredUsers: ignoredUsersDraft,
    });
  };

  const handleApplyClick = () => {
    applyChanges();
  };

  const handleOkClick = () => {
    applyChanges();
    onClose?.();
  };

  const handleAddIgnored = () => {
    const trimmed = newIgnoredUser.trim();
    if (!trimmed) return;
    if (ignoredUsersDraft.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) {
      setNewIgnoredUser("");
      return;
    }
    setIgnoredUsersDraft((prev) => [...prev, trimmed]);
    setSelectedIgnoredIndex(ignoredUsersDraft.length);
    setNewIgnoredUser("");
  };

  const handleRemoveIgnored = () => {
    if (selectedIgnoredIndex < 0 || selectedIgnoredIndex >= ignoredUsersDraft.length) return;
    setIgnoredUsersDraft((prev) => prev.filter((_, index) => index !== selectedIgnoredIndex));
    setSelectedIgnoredIndex(-1);
  };

  return (
    <div
      className={`window yahoo-window yahoo-privacy-options-window${isActive ? "" : " is-inactive"}${
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
        <div className="yahoo-header-top">
          <div className="window-title">
            <span>Yahoo! Messenger Privacy Options</span>
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
            <button className="window-btn close" onClick={() => onClose?.()}>
              <img src={closeIcon} alt="Close" />
            </button>
          </div>
        </div>
      </div>

      <div className="yahoo-privacy-options-body">
        <div className="yahoo-privacy-options-group">
          <div className="yahoo-privacy-options-group-title">Who can contact me</div>
          <label className="yahoo-privacy-options-option">
            <input
              type="radio"
              name={`privacy-source-${windowId}`}
              checked={!allowOnlyContactsDraft}
              onChange={() => setAllowOnlyContactsDraft(false)}
            />
            <span>Allow anyone on Yahoo! Messenger to send me messages.</span>
          </label>
          <label className="yahoo-privacy-options-option">
            <input
              type="radio"
              name={`privacy-source-${windowId}`}
              checked={allowOnlyContactsDraft}
              onChange={() => setAllowOnlyContactsDraft(true)}
            />
            <span>Allow only people in my Messenger List.</span>
          </label>
        </div>

        <div className="yahoo-privacy-options-group">
          <div className="yahoo-privacy-options-group-title">Status and visibility</div>
          <label className="yahoo-privacy-options-option">
            <input
              type="checkbox"
              checked={invisibleDraft}
              onChange={(event) => setInvisibleDraft(event.target.checked)}
            />
            <span>Sign in as invisible (appear offline to everyone).</span>
          </label>
          <label className="yahoo-privacy-options-option">
            <input
              type="checkbox"
              checked={showYahooSitesDraft}
              onChange={(event) => setShowYahooSitesDraft(event.target.checked)}
            />
            <span>Allow Yahoo! websites to show when I am online.</span>
          </label>
          <label className="yahoo-privacy-options-option">
            <input
              type="checkbox"
              checked={noIncomingCallsDraft}
              onChange={(event) => setNoIncomingCallsDraft(event.target.checked)}
            />
            <span>No incoming calls.</span>
          </label>
        </div>

        <div className="yahoo-privacy-options-group is-ignore-list">
          <div className="yahoo-privacy-options-group-title">Ignored users</div>
          <div className="yahoo-privacy-options-ignore-layout">
            <div className="yahoo-privacy-options-ignore-list" role="listbox" aria-label="Ignored users">
              {ignoredUsersDraft.length ? (
                ignoredUsersDraft.map((entry, index) => (
                  <button
                    key={`${entry}-${index}`}
                    type="button"
                    className={`yahoo-privacy-options-ignore-item${
                      selectedIgnoredIndex === index ? " is-selected" : ""
                    }`}
                    onClick={() => setSelectedIgnoredIndex(index)}
                  >
                    {entry}
                  </button>
                ))
              ) : (
                <div className="yahoo-privacy-options-ignore-empty">No ignored users.</div>
              )}
            </div>
            <div className="yahoo-privacy-options-ignore-controls">
              <input
                type="text"
                className="yahoo-privacy-options-input"
                placeholder="Yahoo ID"
                value={newIgnoredUser}
                onChange={(event) => setNewIgnoredUser(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddIgnored();
                  }
                }}
              />
              <div className="yahoo-privacy-options-ignore-buttons">
                <button
                  type="button"
                  className="yahoo-privacy-options-btn"
                  onClick={handleAddIgnored}
                >
                  Add
                </button>
                <button
                  type="button"
                  className="yahoo-privacy-options-btn"
                  onClick={handleRemoveIgnored}
                  disabled={selectedIgnoredIndex < 0}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="yahoo-privacy-options-actions">
          <button
            type="button"
            className="yahoo-privacy-options-btn"
            onClick={handleApplyClick}
            disabled={!hasChanges}
          >
            Apply
          </button>
          <button type="button" className="yahoo-privacy-options-btn is-primary" onClick={handleOkClick}>
            OK
          </button>
          <button type="button" className="yahoo-privacy-options-btn" onClick={() => onClose?.()}>
            Cancel
          </button>
        </div>
      </div>

      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default YahooPrivacyOptionsWindow;
