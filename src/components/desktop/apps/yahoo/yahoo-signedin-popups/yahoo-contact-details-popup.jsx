import React from "react";
import closeIcon from "../../../../../assets/yahoo/header/close.png";
import "../../../../../styles/desktop/apps/yahoo/yahoo-signedin-popups/yahoo-contact-details-popup.css";

const YahooContactDetailsPopup = ({
  isOpen = false,
  popupRef,
  position = { x: 0, y: 22 },
  usernameDraft = "",
  statusDraft = "",
  presenceDraft = "online",
  presenceOptions = [],
  onUsernameChange,
  onStatusChange,
  onPresenceChange,
  onSave,
  onCancel,
  onClose,
  onHeaderMouseDown,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="yahoo-signedin-contact-details-popup"
      role="dialog"
      aria-label="My Contact Details"
      ref={popupRef}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="yahoo-signedin-contact-details-header" onMouseDown={onHeaderMouseDown}>
        <div className="yahoo-signedin-contact-details-title">My Contact Details</div>
        <button
          type="button"
          className="yahoo-signedin-contact-details-close"
          aria-label="Close"
          onClick={() => onClose?.()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <img src={closeIcon} alt="" aria-hidden="true" />
        </button>
      </div>
      <div className="yahoo-signedin-contact-details-body">
        <div className="yahoo-signedin-contact-details-grid">
          <label className="yahoo-signedin-contact-details-field">
            <span>Yahoo! ID:</span>
            <input
              type="text"
              value={usernameDraft}
              onChange={(event) => onUsernameChange?.(event.target.value)}
            />
          </label>
          <label className="yahoo-signedin-contact-details-field">
            <span>Network:</span>
            <select defaultValue="yahoo-messenger">
              <option value="yahoo-messenger">Yahoo! Messenger</option>
            </select>
          </label>
          <label className="yahoo-signedin-contact-details-field">
            <span>Status Message:</span>
            <input
              type="text"
              value={statusDraft}
              onChange={(event) => onStatusChange?.(event.target.value)}
            />
          </label>
          <label className="yahoo-signedin-contact-details-field">
            <span>Availability:</span>
            <select
              value={presenceDraft}
              onChange={(event) => onPresenceChange?.(event.target.value)}
            >
              {presenceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="yahoo-signedin-contact-details-tip">
          Update your profile details shown in Messenger.
        </div>
        <div className="yahoo-signedin-contact-details-actions">
          <button
            type="button"
            className="yahoo-signedin-contact-details-btn is-primary"
            onClick={() => onSave?.()}
          >
            Save
          </button>
          <button
            type="button"
            className="yahoo-signedin-contact-details-btn"
            onClick={() => onCancel?.()}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default YahooContactDetailsPopup;
