import React, { useEffect, useRef, useState } from "react";
import yahooAppIcon from "../../../../assets/yahoo/yahooapp.webp";
import minimizeIcon from "../../../../assets/yahoo/header/window-minimize.webp";
import maximizeIcon from "../../../../assets/yahoo/header/maximise.webp";
import closeIcon from "../../../../assets/yahoo/header/close.webp";
import ResizeHandles from "../../ResizeHandles";
import useWindowResize from "../../hooks/useWindowResize";
import { getDesktopPoint } from "../../utils/desktopTransform";
import "../../../../styles/desktop/window.css";
import "../../../../styles/desktop/apps/yahoo/yahoo.css";
import "../../../../styles/desktop/apps/yahoo/addfriends.css";

const WINDOW_SIZE = { width: 440, height: 420 };

const getDefaultPosition = () => {
  if (typeof window === "undefined") return { x: 300, y: 120 };
  return {
    x: Math.max(80, Math.round((window.innerWidth - WINDOW_SIZE.width) / 2)),
    y: Math.max(80, Math.round((window.innerHeight - WINDOW_SIZE.height - 30) / 2)),
  };
};

const YahooAddFriendsWindow = ({
  windowId = "yahoo-addfriends-window",
  onClose,
  onMinimize,
  onMaximize,
  zIndex,
  onMouseDown,
  onAddFriend,
  groups = ["Friends"],
  isActive = true,
  isMinimized = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState(getDefaultPosition);
  const [size, setSize] = useState(WINDOW_SIZE);
  const [messengerId, setMessengerId] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [step, setStep] = useState(1);
  const [introText, setIntroText] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(
    () => (Array.isArray(groups) && groups.length ? groups[0] : "Friends")
  );
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [nameFirst, setNameFirst] = useState("victor");
  const [nameLast, setNameLast] = useState("hari");
  const displayName = `${nameFirst} ${nameLast}`.trim();
  const trimmedMessengerId = messengerId.trim();
  const dragOffset = useRef({ x: 0, y: 0 });
  const originalPosition = useRef(getDefaultPosition());
  const originalSize = useRef(WINDOW_SIZE);

  const { startResize } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 360,
    minHeight: 360,
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

  useEffect(() => {
    if (!Array.isArray(groups) || !groups.length) {
      setSelectedGroup("Friends");
      return;
    }
    if (groups.includes(selectedGroup)) return;
    setSelectedGroup(groups[0]);
  }, [groups, selectedGroup]);

  const handleAddFriend = () => {
    if (!trimmedMessengerId) return;
    onAddFriend?.(trimmedMessengerId, selectedGroup);
    onClose?.(windowId);
  };

  return (
    <div
      className={`window yahoo-window yahoo-addfriends-window${isActive ? "" : " is-inactive"}${
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
            <span>Add to Messenger List</span>
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

      <div className="yahoo-addfriends-body">
        {step === 1 ? (
          <>
            <div className="yahoo-addfriends-row">
              <div className="yahoo-addfriends-field">
                <label className="yahoo-addfriends-label">
                  Enter a Messenger ID or email address:
                </label>
                <input
                  type="text"
                  className="yahoo-addfriends-input"
                  value={messengerId}
                  onChange={(event) => setMessengerId(event.target.value)}
                />
               
                <div className="yahoo-addfriends-example">
                  <span className="yahoo-addfriends-example-label">Example:</span>
                  <span>hari</span>
                  <span>example@yahoo.com</span>
                  <span>example@sbcglobal.net</span>
                  <span>example@hotmail.com</span>
                </div>
              </div>
              <div className="yahoo-addfriends-network">
                <label className="yahoo-addfriends-label">Network:</label>
                <select className="yahoo-addfriends-select" defaultValue="yahoo">
                  <option value="yahoo">Yahoo! Messenger</option>
                </select>
              </div>
            </div>

            <div className="yahoo-addfriends-row is-mobile">
              <div className="yahoo-addfriends-field">
                <label className="yahoo-addfriends-label">
                  Enter a mobile device number (optional):
                </label>
                <input
                  type="text"
                  className="yahoo-addfriends-input"
                  value={mobileNumber}
                  onChange={(event) => setMobileNumber(event.target.value)}
                />
                <div className="yahoo-addfriends-example">
                  <span className="yahoo-addfriends-example-label">
                    Send SMS (text) messages from your computer.
                  </span>
                  <span>Example: (408) 555-1212</span>
                  <span>+1 408-555-1212</span>
                  <span>+91 98 222 49494</span>
                </div>
              </div>
              <div className="yahoo-addfriends-tip">
                Add a mobile number so you can send an SMS (text) message right from Messenger!
              </div>
            </div>

            <div className="yahoo-addfriends-or">Or</div>
            <button type="button" className="yahoo-addfriends-book">
              Choose a Contact from Your Address Book...
            </button>

            <div className="yahoo-addfriends-divider" />

            <div className="yahoo-addfriends-actions">
              <button type="button" className="yahoo-addfriends-btn" disabled>
                &lt; Back
              </button>
              <button
                type="button"
                className="yahoo-addfriends-btn is-primary"
                onClick={() => setStep(2)}
              >
                Next &gt;
              </button>
              <button
                type="button"
                className="yahoo-addfriends-btn"
                onClick={() => onClose?.(windowId)}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="yahoo-addfriends-step">
            <label className="yahoo-addfriends-label">
              Choose or enter a Messenger List group for{" "}
              <span className="yahoo-addfriends-strong">
                {messengerId.trim() || "this contact"}
              </span>
              :
            </label>
            <select
              className="yahoo-addfriends-select yahoo-addfriends-select-wide"
              value={selectedGroup}
              onChange={(event) => setSelectedGroup(event.target.value)}
            >
              {(Array.isArray(groups) && groups.length ? groups : ["Friends"]).map((groupName) => (
                <option key={groupName} value={groupName}>
                  {groupName}
                </option>
              ))}
            </select>

            <div className="yahoo-addfriends-divider is-soft" />

            <p className="yahoo-addfriends-help">
              A message will be sent asking this person to approve your request to add
              him or her to your Messenger List.
            </p>

            <label className="yahoo-addfriends-label">
              Enter a brief introduction (optional):
            </label>
            <input
              type="text"
              className="yahoo-addfriends-input"
              value={introText}
              onChange={(event) => setIntroText(event.target.value)}
            />

            <div className="yahoo-addfriends-name-row">
              <div>
                <div className="yahoo-addfriends-label">Send your name with this request as:</div>
                <div className="yahoo-addfriends-name">{displayName || "victor hari"}</div>
              </div>
              <button
                type="button"
                className="yahoo-addfriends-btn is-secondary"
                onClick={() => setIsNameDialogOpen(true)}
              >
                Change...
              </button>
            </div>

            <div className="yahoo-addfriends-divider" />

            <div className="yahoo-addfriends-actions">
              <button type="button" className="yahoo-addfriends-btn" onClick={() => setStep(1)}>
                &lt; Back
              </button>
              <button
                type="button"
                className="yahoo-addfriends-btn is-primary"
                onClick={handleAddFriend}
              >
                Next &gt;
              </button>
              <button
                type="button"
                className="yahoo-addfriends-btn"
                onClick={() => onClose?.(windowId)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {isNameDialogOpen ? (
          <div className="yahoo-addfriends-name-overlay" role="dialog" aria-modal="true">
            <div className="yahoo-addfriends-name-dialog">
              <div className="yahoo-addfriends-name-header">
                <span className="yahoo-addfriends-name-title-text">Change Name</span>
              </div>
              <div className="yahoo-addfriends-name-title">
                Enter your name as you want it to appear in this request:
              </div>
              <div className="yahoo-addfriends-name-fields">
                <label className="yahoo-addfriends-name-field">
                  <input
                    type="text"
                    className="yahoo-addfriends-input"
                    value={nameFirst}
                    onChange={(event) => setNameFirst(event.target.value)}
                  />
                  <span className="yahoo-addfriends-name-label">
                    <span className="yahoo-addfriends-accelerator">F</span>irst
                  </span>
                </label>
                <label className="yahoo-addfriends-name-field">
                  <input
                    type="text"
                    className="yahoo-addfriends-input"
                    value={nameLast}
                    onChange={(event) => setNameLast(event.target.value)}
                  />
                  <span className="yahoo-addfriends-name-label">
                    <span className="yahoo-addfriends-accelerator">L</span>ast
                  </span>
                </label>
              </div>
              <div className="yahoo-addfriends-name-actions">
                <button
                  type="button"
                  className="yahoo-addfriends-btn is-primary"
                  onClick={() => setIsNameDialogOpen(false)}
                >
                  OK
                </button>
                <button
                  type="button"
                  className="yahoo-addfriends-btn is-cancel"
                  onClick={() => setIsNameDialogOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default YahooAddFriendsWindow;
