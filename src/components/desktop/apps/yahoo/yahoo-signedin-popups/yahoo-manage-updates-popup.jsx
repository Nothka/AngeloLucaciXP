import React from "react";
import closeIcon from "../../../../../assets/yahoo/header/close.png";
import "../../../../../styles/desktop/apps/yahoo/yahoo-signedin-popups/yahoo-manage-updates-popup.css";

const AUDIENCE_OPTIONS = [
  { value: "anyone", label: "Anyone" },
  { value: "connections", label: "My Connections" },
  { value: "none", label: "No One" },
];

const YahooManageUpdatesPopup = ({
  isOpen = false,
  popupRef,
  audience = "connections",
  broadcastStatus = true,
  broadcastDisplayImage = true,
  broadcastSocial = true,
  onAudienceChange,
  onBroadcastStatusChange,
  onBroadcastDisplayImageChange,
  onBroadcastSocialChange,
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="yahoo-signedin-manage-updates-popup" role="dialog" ref={popupRef}>
      <div className="yahoo-signedin-manage-updates-header">
        <div className="yahoo-signedin-manage-updates-title">Manage Updates I Broadcast</div>
        <button
          type="button"
          className="yahoo-signedin-manage-updates-close"
          aria-label="Close"
          onClick={() => onClose?.()}
        >
          <img src={closeIcon} alt="" aria-hidden="true" />
        </button>
      </div>
      <div className="yahoo-signedin-manage-updates-body">
        <div className="yahoo-signedin-manage-updates-section">
          <div className="yahoo-signedin-manage-updates-section-title">Who can see my updates</div>
          <div className="yahoo-signedin-manage-updates-options">
            {AUDIENCE_OPTIONS.map((option) => (
              <label key={option.value} className="yahoo-signedin-manage-updates-option">
                <input
                  type="radio"
                  name="yahoo-manage-updates-audience"
                  checked={audience === option.value}
                  onChange={() => onAudienceChange?.(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="yahoo-signedin-manage-updates-section">
          <div className="yahoo-signedin-manage-updates-section-title">What I broadcast</div>
          <div className="yahoo-signedin-manage-updates-options">
            <label className="yahoo-signedin-manage-updates-option">
              <input
                type="checkbox"
                checked={broadcastStatus}
                onChange={(event) => onBroadcastStatusChange?.(event.target.checked)}
              />
              <span>Status messages and availability.</span>
            </label>
            <label className="yahoo-signedin-manage-updates-option">
              <input
                type="checkbox"
                checked={broadcastDisplayImage}
                onChange={(event) => onBroadcastDisplayImageChange?.(event.target.checked)}
              />
              <span>Display image changes.</span>
            </label>
            <label className="yahoo-signedin-manage-updates-option">
              <input
                type="checkbox"
                checked={broadcastSocial}
                onChange={(event) => onBroadcastSocialChange?.(event.target.checked)}
              />
              <span>Connected social activity.</span>
            </label>
          </div>
        </div>

        <div className="yahoo-signedin-manage-updates-tip">
          These settings control what appears in Y! Updates.
        </div>

        <div className="yahoo-signedin-manage-updates-actions">
          <button
            type="button"
            className="yahoo-signedin-manage-updates-btn is-primary"
            onClick={() => onSave?.()}
          >
            Save
          </button>
          <button
            type="button"
            className="yahoo-signedin-manage-updates-btn"
            onClick={() => onClose?.()}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default YahooManageUpdatesPopup;
