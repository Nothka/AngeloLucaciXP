import React from "react";
import closeIcon from "../../../../../assets/yahoo/header/close.webp";
import "../../../../../styles/desktop/apps/yahoo/yahoo-signedin-popups/yahoo-conversation-history-popup.css";

const formatHistoryTime = (createdAt) => {
  if (typeof createdAt !== "number" || !Number.isFinite(createdAt)) {
    return "Current session";
  }
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "Current session";
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const YahooConversationHistoryPopup = ({
  isOpen = false,
  popupRef,
  contact = null,
  searchValue = "",
  onSearchChange,
  messages = [],
  totalMessages = 0,
  statusText = "",
  onOpenConversation,
  onClearHistory,
  onClose,
}) => {
  if (!isOpen || !contact) return null;

  const safeMessages = Array.isArray(messages) ? messages : [];
  const safeTotal = Number.isFinite(totalMessages)
    ? totalMessages
    : safeMessages.length;
  const hasMessages = safeMessages.length > 0;

  return (
    <div className="yahoo-signedin-conversation-history-popup" role="dialog" ref={popupRef}>
      <div className="yahoo-signedin-conversation-history-header">
        <div className="yahoo-signedin-conversation-history-title">Conversation History</div>
        <button
          type="button"
          className="yahoo-signedin-conversation-history-close"
          aria-label="Close"
          onClick={() => onClose?.()}
        >
          <img src={closeIcon} alt="" aria-hidden="true" />
        </button>
      </div>

      <div className="yahoo-signedin-conversation-history-body">
        <div className="yahoo-signedin-conversation-history-contact-row">
          <span>Contact:</span>
          <strong>{contact.name}</strong>
        </div>

        <label className="yahoo-signedin-conversation-history-search-row">
          <span>Find:</span>
          <input
            type="text"
            value={searchValue}
            placeholder="Search in messages..."
            onChange={(event) => onSearchChange?.(event.target.value)}
          />
        </label>

        <div className="yahoo-signedin-conversation-history-list">
          {hasMessages ? (
            safeMessages.map((message) => (
              <div key={message.id} className="yahoo-signedin-conversation-history-item">
                <div className="yahoo-signedin-conversation-history-item-meta">
                  <span className="yahoo-signedin-conversation-history-item-sender">
                    {message.sender}
                  </span>
                  <span className="yahoo-signedin-conversation-history-item-time">
                    {formatHistoryTime(message.createdAt)}
                  </span>
                </div>
                <div className="yahoo-signedin-conversation-history-item-text">
                  {message.text || "(empty message)"}
                </div>
              </div>
            ))
          ) : (
            <div className="yahoo-signedin-conversation-history-empty">
              {safeTotal
                ? "No messages match your search."
                : `No saved messages with ${contact.name}.`}
            </div>
          )}
        </div>

        <div className="yahoo-signedin-conversation-history-status">
          {statusText || `${safeMessages.length}/${safeTotal} messages shown.`}
        </div>

        <div className="yahoo-signedin-conversation-history-actions">
          <button
            type="button"
            className="yahoo-signedin-conversation-history-btn"
            disabled={!safeTotal}
            onClick={() => onClearHistory?.()}
          >
            Clear History
          </button>
          <button
            type="button"
            className="yahoo-signedin-conversation-history-btn is-primary"
            onClick={() => onOpenConversation?.(contact)}
          >
            Message
          </button>
          <button
            type="button"
            className="yahoo-signedin-conversation-history-btn"
            onClick={() => onClose?.()}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default YahooConversationHistoryPopup;
