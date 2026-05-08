import React, { useEffect, useRef, useState } from "react";
import commandPromptIcon from "../../assets/icons/apps/commandprompt.webp";
import closeIcon from "../../assets/icons/ui/window-controls/Exit.webp";
import "../../styles/desktop/run-dialog.css";

const DEFAULT_ERROR =
  "Windows cannot find the command. Make sure you typed the name correctly, and then try again.";

const RunDialog = ({ isOpen, onClose, onRun }) => {
  const [command, setCommand] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const handleClose = () => {
    setError("");
    onClose?.();
  };

  useEffect(() => {
    if (!isOpen) return;
    const focusTimeout = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(focusTimeout);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExecute = () => {
    const result = onRun?.(command) ?? { success: true };
    if (result?.success) {
      setCommand("");
      setError("");
      handleClose();
      return;
    }
    setError(result?.message || DEFAULT_ERROR);
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      handleClose();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      handleExecute();
    }
  };

  return (
    <>
      <div
        className="run-dialog-backdrop"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className="run-dialog-window"
        role="dialog"
        aria-modal="true"
        aria-label="Run"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="run-dialog-titlebar">
          <span className="run-dialog-title">Run</span>
          <button
            type="button"
            className="run-dialog-close-btn"
            onClick={handleClose}
            aria-label="Close"
          >
            <img src={closeIcon} alt="" />
          </button>
        </div>
        <div className="run-dialog-body">
          <div className="run-dialog-message-row">
            <img src={commandPromptIcon} alt="" className="run-dialog-icon" />
            <p className="run-dialog-message">
              Type the name of a program, folder, document, or Internet resource, and Windows
              will open it for you.
            </p>
          </div>

          <label className="run-dialog-input-row">
            <span className="run-dialog-input-label">Open:</span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              className="run-dialog-input"
              autoComplete="off"
              spellCheck={false}
              aria-label="Open"
            />
          </label>

          {error ? <p className="run-dialog-error">{error}</p> : null}
        </div>
        <div className="run-dialog-actions">
          <button type="button" className="run-dialog-btn" onClick={handleExecute}>
            OK
          </button>
          <button type="button" className="run-dialog-btn" onClick={handleClose}>
            Cancel
          </button>
          <button type="button" className="run-dialog-btn" disabled>
            Browse...
          </button>
        </div>
      </div>
    </>
  );
};

export default RunDialog;
