import React from "react";
import defaultContactImage from "../../../../../assets/yahoo/yahoo-window/123.png";
import userAvatar from "../../../../../assets/yahoo/soccer.png";
import YahooConversationHeader from "./yahoo-conversation-header";
import YahooConversationBody from "./yahoo-conversation-body";
import YahooConversationFooter from "./yahoo-conversation-footer";
import "../../../../../styles/desktop/apps/yahoo/yahoo-conversation-window/yahoo-window-design.css";

const YahooConversationWindowDesign = ({
  contactName = "softpedia_review3",
  contactImage,
  username = "angelo_lucaci",
  messages = [],
  draft = "",
  onDraftChange,
  onSendMessage,
  onBuzzMessage,
  tabs = [],
  activeTabId = null,
  onTabSelect,
}) => {
  const contactImageSrc = contactImage || defaultContactImage;

  return (
    <div className="yahoo-conversation-design">
      <YahooConversationHeader contactName={contactName} />
      <div className="yahoo-conversation-content">
        <div className="yahoo-conversation-main">
          <YahooConversationBody contactName={contactName} username={username} messages={messages} />
        </div>
        <aside className="yahoo-conversation-side">
          <div className="yahoo-conversation-side-card is-contact">
            <img src={contactImageSrc} alt={`${contactName} photo`} draggable="false" />
          </div>
          <div className="yahoo-conversation-side-card is-user">
            <img src={userAvatar} alt={`${username} avatar`} draggable="false" />
          </div>
        </aside>
        <div className="yahoo-conversation-footer-wrap">
          <YahooConversationFooter
          draft={draft}
          onDraftChange={onDraftChange}
          onSendMessage={onSendMessage}
          onBuzzMessage={onBuzzMessage}
        />
        </div>
        <div className="yahoo-conversation-tabs-row">
          <div className="yahoo-conversation-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`yahoo-conversation-tab${tab.id === activeTabId ? " is-active" : ""}`}
                onClick={() => onTabSelect?.(tab.id)}
              >
                {tab.icon ? (
                  <img
                    src={tab.icon}
                    alt=""
                    className="yahoo-conversation-tab-icon"
                    draggable="false"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="yahoo-conversation-tab-icon is-placeholder" aria-hidden="true" />
                )}
                {tab.label || contactName}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default YahooConversationWindowDesign;
