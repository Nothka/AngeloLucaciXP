import React from "react";
import closeIcon from "../../../../../assets/yahoo/header/close.webp";
import "../../../../../styles/desktop/apps/yahoo/yahoo-signedin-popups/yahoo-address-book-popup.css";

const YahooAddressBookPopup = ({
  isOpen = false,
  popupRef,
  searchValue = "",
  onSearchChange,
  contacts = [],
  selectedContactId = "",
  onSelectContact,
  onAdd,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="yahoo-signedin-address-book-popup" role="dialog" ref={popupRef}>
      <div className="yahoo-signedin-address-book-header">
        <div className="yahoo-signedin-address-book-title">Add Address Book Contact</div>
        <button
          type="button"
          className="yahoo-signedin-address-book-close"
          aria-label="Close"
          onClick={() => onClose?.()}
        >
          <img src={closeIcon} alt="" aria-hidden="true" />
        </button>
      </div>

      <div className="yahoo-signedin-address-book-body">
        <label className="yahoo-signedin-address-book-search">
          <span>Search:</span>
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="Type name or email..."
          />
        </label>

        <div className="yahoo-signedin-address-book-list" role="listbox" aria-label="Address book">
          {contacts.length ? (
            contacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                className={`yahoo-signedin-address-book-item${
                  selectedContactId === contact.id ? " is-selected" : ""
                }`}
                onClick={() => onSelectContact?.(contact.id)}
              >
                <span className="yahoo-signedin-address-book-name">{contact.name}</span>
                <span className="yahoo-signedin-address-book-email">{contact.email}</span>
              </button>
            ))
          ) : (
            <div className="yahoo-signedin-address-book-empty">
              No address book contacts found.
            </div>
          )}
        </div>

        <div className="yahoo-signedin-address-book-actions">
          <button
            type="button"
            className="yahoo-signedin-address-book-btn is-primary"
            onClick={() => onAdd?.()}
            disabled={!selectedContactId}
          >
            Add
          </button>
          <button
            type="button"
            className="yahoo-signedin-address-book-btn"
            onClick={() => onClose?.()}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default YahooAddressBookPopup;
