import React from "react";
import closeIcon from "../../../../../assets/yahoo/header/close.webp";
import "../../../../../styles/desktop/apps/yahoo/yahoo-signedin-popups/yahoo-account-info-popup.css";

const YahooAccountInfoPopup = ({
  isOpen = false,
  popupRef,
  username = "",
  availabilityLabel = "Available",
  statusText = "",
  onManageAccount,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="yahoo-signedin-account-info-popup" role="dialog" ref={popupRef}>
      <div className="yahoo-signedin-account-info-header">
        <div className="yahoo-signedin-account-info-title">My Account Info</div>
        <button
          type="button"
          className="yahoo-signedin-account-info-close"
          aria-label="Close"
          onClick={() => onClose?.()}
        >
          <img src={closeIcon} alt="" aria-hidden="true" />
        </button>
      </div>
      <div className="yahoo-signedin-account-info-body">
        <div className="yahoo-signedin-account-info-grid">
          <div className="yahoo-signedin-account-info-row">
            <span className="yahoo-signedin-account-info-label">Yahoo! ID:</span>
            <span className="yahoo-signedin-account-info-value">{username}</span>
          </div>
          <div className="yahoo-signedin-account-info-row">
            <span className="yahoo-signedin-account-info-label">Display Name:</span>
            <span className="yahoo-signedin-account-info-value">{username}</span>
          </div>
          <div className="yahoo-signedin-account-info-row">
            <span className="yahoo-signedin-account-info-label">Availability:</span>
            <span className="yahoo-signedin-account-info-value">{availabilityLabel}</span>
          </div>
          <div className="yahoo-signedin-account-info-row">
            <span className="yahoo-signedin-account-info-label">Status Message:</span>
            <span className="yahoo-signedin-account-info-value">
              {statusText.trim() || "No status message"}
            </span>
          </div>
          <div className="yahoo-signedin-account-info-row">
            <span className="yahoo-signedin-account-info-label">Yahoo! Mail:</span>
            <span className="yahoo-signedin-account-info-value">{username}@yahoo.com</span>
          </div>
        </div>
        <div className="yahoo-signedin-account-info-tip">
          Manage your Yahoo account profile, security, and sign-in settings.
        </div>
        <div className="yahoo-signedin-account-info-actions">
          <button
            type="button"
            className="yahoo-signedin-account-info-btn is-primary"
            onClick={() => onManageAccount?.()}
          >
            Manage Account...
          </button>
          <button
            type="button"
            className="yahoo-signedin-account-info-btn"
            onClick={() => onClose?.()}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default YahooAccountInfoPopup;
