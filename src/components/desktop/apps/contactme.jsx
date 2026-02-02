import React, { useEffect, useRef, useState } from "react";
import contactIcon from "../../../assets/startmenu/contact.webp";
import sendIcon from "../../../assets/contact-me/send.webp";
import newMessageIcon from "../../../assets/contact-me/new.webp";
import copyIcon from "../../../assets/contact-me/Copy.webp";
import pasteIcon from "../../../assets/contact-me/Paste.webp";
import cutIcon from "../../../assets/contact-me/Cut.png";
import linkedinIcon from "../../../assets/startmenu/linkedin.png";
import minimizeIcon from "../../../assets/window/Minimize.webp";
import maximizeIcon from "../../../assets/window/Maximize.webp";
import closeIcon from "../../../assets/window/Exit.png";
import ResizeHandles from "../ResizeHandles";
import useWindowResize from "../hooks/useWindowResize";
import { getDesktopPoint } from "../utils/desktopTransform";
import "../../../styles/desktop/window.css";
import "../../../styles/desktop/apps/contactme.css";

const DEFAULT_SIZE = { width: 540, height: 380 };
const DEFAULT_POSITION = { x: 160, y: 120 };

const ContactMeWindow = ({
  windowId,
  title,
  onClose,
  onMinimize,
  onMaximize,
  zIndex,
  onMouseDown,
  onOpenLinkedIn,
  isActive = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [fromValue, setFromValue] = useState("");
  const [subjectValue, setSubjectValue] = useState("");
  const [messageValue, setMessageValue] = useState("");
  const [clipboardText, setClipboardText] = useState("");
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const windowRef = useRef(null);
  const fromRef = useRef(null);
  const subjectRef = useRef(null);
  const messageRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const fileMenuRef = useRef(null);
  const fileButtonRef = useRef(null);
  const viewMenuRef = useRef(null);
  const viewButtonRef = useRef(null);
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

  const isComposing = Boolean(fromValue || subjectValue || messageValue);

  useEffect(() => {
    if (!isFileMenuOpen && !isViewMenuOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (fileMenuRef.current?.contains(event.target)) return;
      if (fileButtonRef.current?.contains(event.target)) return;
      if (viewMenuRef.current?.contains(event.target)) return;
      if (viewButtonRef.current?.contains(event.target)) return;
      setIsFileMenuOpen(false);
      setIsViewMenuOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsFileMenuOpen(false);
        setIsViewMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isFileMenuOpen, isViewMenuOpen]);

  const handleFieldFocus = (event) => {
    lastFocusedRef.current = event.target;
  };

  const resolveTargetField = () => {
    const activeElement = document.activeElement;
    if (activeElement === fromRef.current) return fromRef.current;
    if (activeElement === subjectRef.current) return subjectRef.current;
    if (activeElement === messageRef.current) return messageRef.current;
    if (
      lastFocusedRef.current === fromRef.current ||
      lastFocusedRef.current === subjectRef.current ||
      lastFocusedRef.current === messageRef.current
    ) {
      return lastFocusedRef.current;
    }
    return null;
  };

  const updateFieldValue = (target, nextValue) => {
    if (target === fromRef.current) {
      setFromValue(nextValue);
    } else if (target === subjectRef.current) {
      setSubjectValue(nextValue);
    } else if (target === messageRef.current) {
      setMessageValue(nextValue);
    }
  };

  const handleCut = () => {
    const target = resolveTargetField();
    if (!target) return;
    const { selectionStart, selectionEnd, value } = target;
    if (typeof selectionStart !== "number" || typeof selectionEnd !== "number") return;
    if (selectionStart === selectionEnd) return;
    const selected = value.slice(selectionStart, selectionEnd);
    const nextValue = value.slice(0, selectionStart) + value.slice(selectionEnd);
    updateFieldValue(target, nextValue);
    setClipboardText(selected);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(selected).catch(() => {});
    } else {
      try {
        const temp = document.createElement("textarea");
        temp.value = selected;
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      } catch {}
    }
    requestAnimationFrame(() => {
      target.focus();
      try {
        target.setSelectionRange(selectionStart, selectionStart);
      } catch {}
    });
  };

  const handleCopy = () => {
    const target = resolveTargetField();
    if (!target) return;
    const { selectionStart, selectionEnd, value } = target;
    if (typeof selectionStart !== "number" || typeof selectionEnd !== "number") return;
    if (selectionStart === selectionEnd) return;
    const selected = value.slice(selectionStart, selectionEnd);
    setClipboardText(selected);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(selected).catch(() => {});
    } else {
      try {
        const temp = document.createElement("textarea");
        temp.value = selected;
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      } catch {}
    }
    requestAnimationFrame(() => {
      target.focus();
    });
  };

  const handlePaste = async () => {
    const target = resolveTargetField();
    if (!target) return;
    let pasteValue = clipboardText;
    if (navigator.clipboard?.readText) {
      try {
        pasteValue = await navigator.clipboard.readText();
      } catch {}
    }
    if (!pasteValue) return;
    const { selectionStart, selectionEnd, value } = target;
    const start = typeof selectionStart === "number" ? selectionStart : value.length;
    const end = typeof selectionEnd === "number" ? selectionEnd : value.length;
    const nextValue = value.slice(0, start) + pasteValue + value.slice(end);
    updateFieldValue(target, nextValue);
    const caret = start + pasteValue.length;
    requestAnimationFrame(() => {
      target.focus();
      try {
        target.setSelectionRange(caret, caret);
      } catch {}
    });
  };

  const handleNewMessage = () => {
    setFromValue("");
    setSubjectValue("");
    setMessageValue("");
    requestAnimationFrame(() => {
      fromRef.current?.focus();
    });
  };

  const handleSendMessage = () => {
    if (!isComposing) return;
    const toAddress = "angelolucaci@gmail.com";
    const subject = subjectValue.trim();
    const trimmedMessage = messageValue.trim();

    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (trimmedMessage) params.set("body", trimmedMessage);

    const query = params.toString();
    window.location.href = `mailto:${toAddress}${query ? `?${query}` : ""}`;
  };

  const handleFileMenuNew = () => {
    handleNewMessage();
    setIsFileMenuOpen(false);
  };

  const handleFileMenuSend = () => {
    handleSendMessage();
    setIsFileMenuOpen(false);
  };

  const handleFileMenuPrint = () => {
    setIsFileMenuOpen(false);
  };

  const handleFileMenuExit = () => {
    setIsFileMenuOpen(false);
    onClose?.(windowId);
  };

  const handleViewMenuMaximize = () => {
    if (!isMaximized) {
      setIsMaximized(true);
      onMaximize?.(windowId);
    }
    setIsViewMenuOpen(false);
  };

  const handleViewMenuMinimize = () => {
    setIsViewMenuOpen(false);
    onMinimize?.(windowId);
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

  return (
    <div
      className={`window contact-window ${isActive ? "" : "is-inactive"} ${isMaximized ? "maximized" : ""}`}
      ref={windowRef}
      style={{ top: position.y, left: position.x, zIndex, width: size.width, height: size.height }}
      onMouseDown={() => onMouseDown(windowId)}
    >
      <div className="window-header" onMouseDown={handleMouseDown} onDoubleClick={toggleMaximize}>
        <div className="window-title">
          <img src={contactIcon} alt="Contact Me" className="window-title-icon" />
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

      <div className="window-menu-bar">
        <div className="contact-menu-wrapper">
          <button
            ref={fileButtonRef}
            type="button"
            className={`window-menu-btn contact-menu-trigger ${isFileMenuOpen ? "is-open" : ""}`}
            onClick={() => {
              setIsViewMenuOpen(false);
              setIsFileMenuOpen((prev) => !prev);
            }}
          >
            File
          </button>
          {isFileMenuOpen ? (
            <div className="contact-menu" ref={fileMenuRef}>
              <button
                type="button"
                className="contact-menu-item"
                onClick={handleFileMenuNew}
              >
                New Message
              </button>
              <button
                type="button"
                className={`contact-menu-item ${isComposing ? "" : "is-disabled"}`}
                disabled={!isComposing}
                onClick={handleFileMenuSend}
              >
                Send Message
              </button>
              <button
                type="button"
                className="contact-menu-item is-disabled"
                disabled
                onClick={handleFileMenuPrint}
              >
                Print
              </button>
              <div className="contact-menu-divider" />
              <button
                type="button"
                className="contact-menu-item"
                onClick={handleFileMenuExit}
              >
                Exit
              </button>
            </div>
          ) : null}
        </div>
        <button type="button" className="window-menu-btn is-muted">Edit</button>
        <div className="contact-menu-wrapper">
          <button
            ref={viewButtonRef}
            type="button"
            className={`window-menu-btn contact-menu-trigger ${isViewMenuOpen ? "is-open" : ""}`}
            onClick={() => {
              setIsFileMenuOpen(false);
              setIsViewMenuOpen((prev) => !prev);
            }}
          >
            View
          </button>
          {isViewMenuOpen ? (
            <div className="contact-menu" ref={viewMenuRef}>
              <button type="button" className="contact-menu-item" onClick={handleViewMenuMaximize}>
                Maximize
              </button>
              <button type="button" className="contact-menu-item" onClick={handleViewMenuMinimize}>
                Minimize
              </button>
            </div>
          ) : null}
        </div>
        <button type="button" className="window-menu-btn is-muted">Tools</button>
        <button type="button" className="window-menu-btn is-muted">Help</button>
      </div>

      <div className={`window-toolbar contact-toolbar ${isComposing ? "is-active" : "is-muted"}`}>
        <div className="contact-toolbar-group">
          <div className="contact-tool" onClick={handleSendMessage}>
            <img src={sendIcon} alt="" />
            <span>Send Message</span>
          </div>
          <div className="contact-tool" onClick={handleNewMessage}>
            <img src={newMessageIcon} alt="" />
            <span>New Message</span>
          </div>
        </div>
        <div className="contact-toolbar-separator" />
        <div className="contact-toolbar-group">
          <div
            className="contact-tool contact-tool--icon"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleCut}
          >
            <img src={cutIcon} alt="" />
          </div>
          <div
            className="contact-tool contact-tool--icon"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleCopy}
          >
            <img src={copyIcon} alt="" />
          </div>
          <div
            className="contact-tool contact-tool--icon"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handlePaste}
          >
            <img src={pasteIcon} alt="" />
          </div>
        </div>
        <div className="contact-toolbar-spacer" />
        <div className="contact-toolbar-group contact-toolbar-group--end">
          <button
            type="button"
            className="contact-tool"
            onClick={() => onOpenLinkedIn?.()}
          >
            <img src={linkedinIcon} alt="" />
            <span>LinkedIn</span>
          </button>
        </div>
      </div>

      <div className="contact-body">
        <div className="contact-form">
          <div className="contact-row">
            <label htmlFor={`contact-to-${windowId}`}>To:</label>
            <div id={`contact-to-${windowId}`} className="contact-static">
              angelolucaci@gmail.com
            </div>
          </div>
          <div className="contact-row">
            <label htmlFor={`contact-from-${windowId}`}>From:</label>
            <input
              id={`contact-from-${windowId}`}
              className="contact-input"
              type="email"
              placeholder="Your email address"
              value={fromValue}
              onChange={(event) => setFromValue(event.target.value)}
              onFocus={handleFieldFocus}
              ref={fromRef}
            />
          </div>
          <div className="contact-row contact-row--last">
            <label htmlFor={`contact-subject-${windowId}`}>Subject:</label>
            <input
              id={`contact-subject-${windowId}`}
              className="contact-input"
              type="text"
              placeholder="Subject of your message"
              value={subjectValue}
              onChange={(event) => setSubjectValue(event.target.value)}
              onFocus={handleFieldFocus}
              ref={subjectRef}
            />
          </div>
          <div className="contact-message">
            <textarea
              id={`contact-message-${windowId}`}
              className="contact-textarea"
              placeholder="Write your message here"
              value={messageValue}
              onChange={(event) => setMessageValue(event.target.value)}
              onFocus={handleFieldFocus}
              ref={messageRef}
            />
          </div>
        </div>
      </div>

      <div className="contact-status">Compose a message to Angelo.</div>

      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default ContactMeWindow;
