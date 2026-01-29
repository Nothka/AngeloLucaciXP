import React from "react";
import { EMOTICON_ENTRIES } from "./emoticonData";
import "../../../../styles/desktop/apps/yahoo/emoticonmenu.css";

const YahooEmoticonMenu = ({ isOpen = false, onSelect, menuRef, className = "" }) => {
  const emoticons = EMOTICON_ENTRIES;

  if (!isOpen) return null;

  return (
    <div
      className={`yahoo-emoticon-menu ${className}`.trim()}
      ref={menuRef}
      role="listbox"
      aria-label="Emoticons"
    >
      {emoticons.map((emote) => (
        <button
          key={emote.name}
          type="button"
          className="yahoo-emoticon-item"
          title={emote.code}
          onClick={() => onSelect?.(emote)}
        >
          <img src={emote.src} alt={emote.code} draggable="false" />
        </button>
      ))}
      {!emoticons.length ? (
        <div className="yahoo-emoticon-empty">Add emoticon images to show them here.</div>
      ) : null}
    </div>
  );
};

export default YahooEmoticonMenu;
