import React from "react";
import closeIcon from "../../../../../assets/yahoo/header/close.webp";
import "../../../../../styles/desktop/apps/yahoo/yahoo-signedin-popups/yahoo-selected-contact-details-popup.css";

const YahooSelectedContactDetailsPopup = ({
  isOpen = false,
  popupRef,
  contact = null,
  stealthLabel = "Appear online",
  onSendMessage,
  onClose,
}) => {
  if (!isOpen || !contact) return null;

  const groupLabel = String(contact.group || "Friends").trim() || "Friends";
  const availabilityLabel = contact.status === "offline" ? "Offline" : "Online";
  const displayName = contact.name || "Contact";
  const yahooId = displayName.toLowerCase().replace(/\s+/g, "_");

  return (
    <div className="yahoo-signedin-selected-contact-popup" role="dialog" ref={popupRef}>
      <div className="yahoo-signedin-selected-contact-header">
        <div className="yahoo-signedin-selected-contact-title">Contact Details</div>
        <button
          type="button"
          className="yahoo-signedin-selected-contact-close"
          aria-label="Close"
          onClick={() => onClose?.()}
        >
          <img src={closeIcon} alt="" aria-hidden="true" />
        </button>
      </div>
      <div className="yahoo-signedin-selected-contact-body">
        <div className="yahoo-signedin-selected-contact-overview">
          <img
            src={contact.icon}
            alt={displayName}
            className="yahoo-signedin-selected-contact-avatar"
            draggable="false"
          />
          <div className="yahoo-signedin-selected-contact-name">{displayName}</div>
        </div>
        <div className="yahoo-signedin-selected-contact-grid">
          <div className="yahoo-signedin-selected-contact-row">
            <span>Yahoo! ID:</span>
            <span>{yahooId}</span>
          </div>
          <div className="yahoo-signedin-selected-contact-row">
            <span>Group:</span>
            <span>{groupLabel}</span>
          </div>
          <div className="yahoo-signedin-selected-contact-row">
            <span>Availability:</span>
            <span>{availabilityLabel}</span>
          </div>
          <div className="yahoo-signedin-selected-contact-row">
            <span>Stealth:</span>
            <span>{stealthLabel}</span>
          </div>
        </div>
        <div className="yahoo-signedin-selected-contact-tip">
          Use Stealth Settings to control how this contact sees your status.
        </div>
        <div className="yahoo-signedin-selected-contact-actions">
          <button
            type="button"
            className="yahoo-signedin-selected-contact-btn is-primary"
            onClick={() => onSendMessage?.(contact)}
          >
            Send Message
          </button>
          <button
            type="button"
            className="yahoo-signedin-selected-contact-btn"
            onClick={() => onClose?.()}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default YahooSelectedContactDetailsPopup;
