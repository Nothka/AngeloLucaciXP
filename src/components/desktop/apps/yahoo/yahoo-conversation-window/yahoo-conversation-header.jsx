import React from "react";
import videoCallIcon from "../../../../../assets/yahoo/videocall.png";
import voiceCallIcon from "../../../../../assets/yahoo/voicecall.png";
import imvironmentsIcon from "../../../../../assets/yahoo/IMViroments.png";
import activitiesIcon from "../../../../../assets/yahoo/activities.png";
import photosIcon from "../../../../../assets/yahoo/photos.png";
import "../../../../../styles/desktop/apps/yahoo/yahoo-conversation-window/yahoo-conversation-header.css";

const MENU_ITEMS = ["Conversation", "Edit", "View", "Actions", "Help"];
const TOOL_ITEMS = [
  { id: "video", label: "Video Call", icon: videoCallIcon, isFaded: true },
  { id: "voice", label: "Voice Call", icon: voiceCallIcon, hasCaret: true, isDivider: true },
  {
    id: "imv",
    label: "IMVironments",
    icon: imvironmentsIcon,
    hasCaret: true,
    isFaded: true,
    isRightStart: true,
  },
  { id: "activities", label: "Activities", icon: activitiesIcon, hasCaret: true, isFaded: true },
  { id: "photos", label: "Photos", icon: photosIcon, isFaded: true },
];

const YahooConversationHeader = ({ contactName = "Contact name" }) => {
  const requestMicrophoneAccess = async () => {
    if (typeof navigator === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      // Ignore permission errors.
    }
  };

  return (
    <div className="yahoo-conversation-header" onMouseDown={(event) => event.stopPropagation()}>
      <div className="yahoo-conversation-menu">
        {MENU_ITEMS.map((item) => (
          <button key={item} type="button" className="yahoo-conversation-menu-item">
            {item}
          </button>
        ))}
      </div>
      <div className="yahoo-conversation-tools">
        {TOOL_ITEMS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`yahoo-conversation-tool${tool.isFaded ? " is-faded" : ""}${
              tool.isDivider ? " is-divider" : ""
            }${tool.isRightStart ? " is-right-start" : ""}`}
            onClick={tool.id === "voice" ? requestMicrophoneAccess : undefined}
          >
            <span className="yahoo-conversation-tool-icon-wrap">
              <img
                src={tool.icon}
                alt=""
                className={`yahoo-conversation-tool-icon is-${tool.id}`}
                draggable="false"
                aria-hidden="true"
              />
              {tool.hasCaret ? (
                <span className="yahoo-conversation-tool-caret" aria-hidden="true" />
              ) : null}
            </span>
            <span className="yahoo-conversation-tool-label">{tool.label}</span>
          </button>
        ))}
      </div>
      <div className="yahoo-conversation-contact">
        <span className="yahoo-conversation-contact-dot" aria-hidden="true" />
        <span className="yahoo-conversation-contact-name">{contactName}</span>
      </div>
    </div>
  );
};

export default YahooConversationHeader;
