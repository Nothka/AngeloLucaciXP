import React from "react";
import closeIcon from "../../../../../assets/yahoo/header/close.webp";
import "../../../../../styles/desktop/apps/yahoo/yahoo-signedin-popups/yahoo-import-contacts-popup.css";

const YahooImportContactsPopup = ({
  isOpen = false,
  popupRef,
  source = "gmail",
  sourceOptions = [],
  contacts = [],
  selectedContactIds = [],
  isImporting = false,
  statusText = "",
  onSourceChange,
  onToggleContact,
  onImport,
  onClose,
}) => {
  if (!isOpen) return null;
  const selectedContactIdSet = new Set(selectedContactIds);
  const selectedCount = contacts.filter((contact) => selectedContactIdSet.has(contact.id)).length;

  return (
    <div className="yahoo-signedin-import-contacts-popup" role="dialog" ref={popupRef}>
      <div className="yahoo-signedin-import-contacts-header">
        <div className="yahoo-signedin-import-contacts-title">Import Contacts</div>
        <button
          type="button"
          className="yahoo-signedin-import-contacts-close"
          aria-label="Close"
          onClick={() => onClose?.()}
        >
          <img src={closeIcon} alt="" aria-hidden="true" />
        </button>
      </div>

      <div className="yahoo-signedin-import-contacts-body">
        <label className="yahoo-signedin-import-contacts-source-row">
          <span>Import from:</span>
          <select
            value={source}
            onChange={(event) => onSourceChange?.(event.target.value)}
            disabled={isImporting}
          >
            {sourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="yahoo-signedin-import-contacts-preview-title">
          Contacts to import ({selectedCount}/{contacts.length})
        </div>
        <div className="yahoo-signedin-import-contacts-list">
          {contacts.length ? (
            contacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                className={`yahoo-signedin-import-contacts-item${
                  selectedContactIdSet.has(contact.id) ? " is-selected" : ""
                }`}
                onClick={() => onToggleContact?.(contact.id)}
                disabled={isImporting}
              >
                <span className="yahoo-signedin-import-contacts-name">{contact.name}</span>
                <span className="yahoo-signedin-import-contacts-email">{contact.email}</span>
              </button>
            ))
          ) : (
            <div className="yahoo-signedin-import-contacts-empty">No contacts available.</div>
          )}
        </div>

        <div className="yahoo-signedin-import-contacts-status">
          {isImporting
            ? "Importing contacts..."
            : statusText || "Select contacts and click Import."}
        </div>

        <div className="yahoo-signedin-import-contacts-actions">
          <button
            type="button"
            className="yahoo-signedin-import-contacts-btn is-primary"
            onClick={() => onImport?.()}
            disabled={isImporting || !selectedCount}
          >
            {isImporting ? "Importing..." : "Import"}
          </button>
          <button
            type="button"
            className="yahoo-signedin-import-contacts-btn"
            onClick={() => onClose?.()}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default YahooImportContactsPopup;
