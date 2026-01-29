import React, { useEffect, useRef, useState } from "react";
import smileIcon from "../../../../../assets/yahoo/yahoo-window/Untitled design (21).png";
import talkIcon from "../../../../../assets/yahoo/yahoo-window/Untitled design (20).png";
import textIcon from "../../../../../assets/yahoo/yahoo-window/Untitled design (22).png";
import buzzIcon from "../../../../../assets/yahoo/yahoo-window/Untitled design (27).png";
import attachIcon from "../../../../../assets/yahoo/yahoo-window/files.png";
import screenshotIcon from "../../../../../assets/yahoo/yahoo-window/Untitled design (29).png";
import contactsIcon from "../../../../../assets/yahoo/yahoo-window/contacts.png";
import leftArrowIcon from "../../../../../assets/yahoo/yahoo-window/left-arrow.png";
import YahooEmoticonMenu from "../emoticonmenu";
import "../../../../../styles/desktop/apps/yahoo/yahoo-conversation-window/yahoo-conversation-footer.css";

const TOOLBAR_ITEMS = [
  { id: "emote", label: "Emoticons", icon: smileIcon, hasArrow: true },
  { id: "talk", label: "Talk", icon: talkIcon },
  { id: "text", label: "Text", icon: textIcon },
  { id: "buzz", label: "Buzz", icon: buzzIcon },
  { id: "attach", label: "Attach", icon: attachIcon },
  { id: "screenshot", label: "Screenshot", icon: screenshotIcon, hasArrow: true, hasDivider: true },
];

const YahooConversationFooter = ({
  draft = "",
  onDraftChange,
  onSendMessage,
  onBuzzMessage,
}) => {
  const [localDraft, setLocalDraft] = useState(draft);
  const [isEmoteMenuOpen, setIsEmoteMenuOpen] = useState(false);
  const [activeToolId, setActiveToolId] = useState(null);
  const emoteButtonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    setLocalDraft(draft);
  }, [draft]);

  useEffect(() => {
    if (!isEmoteMenuOpen && activeToolId === "emote") {
      setActiveToolId(null);
    }
  }, [activeToolId, isEmoteMenuOpen]);

  useEffect(() => {
    if (!isEmoteMenuOpen) return;
    const handleOutsideClick = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      if (emoteButtonRef.current?.contains(event.target)) return;
      setIsEmoteMenuOpen(false);
      setActiveToolId(null);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isEmoteMenuOpen]);

  const handleEmoteSelect = (emote) => {
    const token = emote?.code || emote?.label || "";
    if (token && onDraftChange) {
      const spacer = localDraft && !localDraft.endsWith(" ") ? " " : "";
      const nextDraft = `${localDraft}${spacer}${token}`;
      setLocalDraft(nextDraft);
      onDraftChange(nextDraft);
    }
    setIsEmoteMenuOpen(false);
    setActiveToolId(null);
  };

  const handleBuzzClick = () => {
    if (onBuzzMessage) {
      onBuzzMessage();
      return;
    }
    onSendMessage?.("BUZZ!!");
  };

  const handleToolToggle = (id, { isEmote = false, isBuzz = false } = {}) => {
    if (isBuzz) {
      handleBuzzClick();
      return;
    }
    setActiveToolId((prev) => (prev === id ? null : id));
    if (isEmote) {
      setIsEmoteMenuOpen((prev) => !prev);
    }
  };

  return (
    <div className="yahoo-conversation-footer">
      <div className="yahoo-conversation-toolbar">
        {TOOLBAR_ITEMS.map((tool) => {
          const isEmote = tool.id === "emote";
          const isBuzz = tool.id === "buzz";
          const isActive = !isBuzz && activeToolId === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              className={[
                "yahoo-conversation-toolbar-button",
                `is-${tool.id}`,
                isActive ? "is-active" : "",
                tool.hasDivider ? "has-caret" : "",
                tool.hasArrow ? "has-arrow" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={tool.label}
              ref={isEmote ? emoteButtonRef : undefined}
              onClick={
                isEmote || isBuzz
                  ? () => handleToolToggle(tool.id, { isEmote, isBuzz })
                  : () => handleToolToggle(tool.id)
              }
            >
              <img
                src={tool.icon}
                alt=""
                className="yahoo-conversation-toolbar-icon"
                draggable="false"
                aria-hidden="true"
              />
              {tool.hasArrow ? (
                <span className="yahoo-conversation-toolbar-caret" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
        <span className="yahoo-conversation-toolbar-spacer" />
        <button type="button" className="yahoo-conversation-toolbar-button is-contacts" aria-label="Contacts">
          <img
            src={leftArrowIcon}
            alt=""
            className="yahoo-conversation-contacts-arrow"
            draggable="false"
            aria-hidden="true"
          />
          <img
            src={contactsIcon}
            alt=""
            className="yahoo-conversation-toolbar-icon is-contacts"
            draggable="false"
            aria-hidden="true"
          />
        </button>
        <YahooEmoticonMenu
          isOpen={isEmoteMenuOpen}
          onSelect={handleEmoteSelect}
          menuRef={menuRef}
        />
      </div>
      <div className="yahoo-conversation-input-row">
        <textarea
          className="yahoo-conversation-input"
          rows="3"
          value={localDraft}
          onChange={(event) => {
            const nextValue = event.target.value;
            setLocalDraft(nextValue);
            onDraftChange?.(nextValue);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSendMessage?.(localDraft);
            }
          }}
        />
        <button
          type="button"
          className="yahoo-conversation-send"
          onClick={() => onSendMessage?.(localDraft)}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default YahooConversationFooter;
