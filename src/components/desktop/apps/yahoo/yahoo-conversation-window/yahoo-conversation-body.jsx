import React, { useEffect, useRef } from "react";
import { EMOTICON_CODE_MAP, EMOTICON_CODES } from "../emoticonData";
import "../../../../../styles/desktop/apps/yahoo/yahoo-conversation-window/yahoo-conversation-body.css";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const EMOTICON_REGEX = new RegExp(
  `(${EMOTICON_CODES.map(escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join("|")})`,
  "g"
);

const isWordChar = (value) => /[A-Za-z0-9_]/.test(value);

const tokenizeMessage = (text) => {
  if (!text) return [];
  const tokens = [];
  let lastIndex = 0;
  const matches = text.matchAll(EMOTICON_REGEX);
  for (const match of matches) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const code = match[0];
    if (code === "!!") {
      const prevChar = match.index > 0 ? text[match.index - 1] : "";
      const nextIndex = match.index + code.length;
      const nextChar = nextIndex < text.length ? text[nextIndex] : "";
      if (isWordChar(prevChar) || isWordChar(nextChar)) {
        tokens.push(code);
        lastIndex = match.index + code.length;
        continue;
      }
    }
    const entry = EMOTICON_CODE_MAP[code];
    if (entry) {
      tokens.push(entry);
    } else {
      tokens.push(code);
    }
    lastIndex = match.index + code.length;
  }
  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }
  return tokens;
};

const YahooConversationBody = ({
  contactName = "softpedia_review3",
  username = "angelo_lucaci",
  messages = [],
  isTyping = false,
  isActive = true,
}) => {
  const messagePaneRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;
    const pane = messagePaneRef.current;
    if (!pane) return;
    const frame = window.requestAnimationFrame(() => {
      pane.scrollTop = pane.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, isTyping, isActive, contactName]);

  return (
    <div className="yahoo-conversation-body">
      <div className="yahoo-conversation-message-pane" ref={messagePaneRef}>
        <button type="button" className="yahoo-conversation-link is-top">
          Show Recent Messages (F3)
        </button>
        {messages.length ? (
          <div className="yahoo-conversation-messages">
            {messages.map((message) => {
              const isUser = message.sender === "user";
              const displayName = isUser ? username : contactName;
              const isBuzz =
                message.isBuzz ||
                String(message.text || "").trim().toUpperCase().startsWith("BUZZ");
              return (
                <div
                  key={message.id}
                  className={`yahoo-conversation-message ${isUser ? "is-user" : "is-contact"}${
                    isBuzz ? " is-buzz" : ""
                  }`}
                >
                  <span
                    className={`yahoo-conversation-message-name ${isUser ? "is-user" : "is-contact"}`}
                  >
                    {displayName}:
                  </span>
                  <span
                    className={`yahoo-conversation-message-text${isBuzz ? " is-buzz" : ""}`}
                  >
                    {isBuzz
                      ? message.text
                      : tokenizeMessage(message.text).map((token, index) =>
                          typeof token === "string" ? (
                            <span key={`${message.id}-text-${index}`}>{token}</span>
                          ) : (
                            <img
                              key={`${message.id}-emote-${index}`}
                              className="yahoo-conversation-emoticon"
                              src={token.src}
                              alt={token.code}
                              title={token.code}
                              draggable="false"
                            />
                          )
                        )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
        {isTyping ? (
          <div className="yahoo-conversation-typing">
            <span className="yahoo-conversation-typing-text">
              {contactName} is typing...
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default YahooConversationBody;
