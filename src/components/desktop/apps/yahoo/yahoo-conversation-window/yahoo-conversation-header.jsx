import React, { useEffect, useRef, useState } from "react";
import videoCallIcon from "../../../../../assets/yahoo/videocall.png";
import voiceCallIcon from "../../../../../assets/yahoo/voicecall.png";
import imvironmentsIcon from "../../../../../assets/yahoo/IMViroments.png";
import activitiesIcon from "../../../../../assets/yahoo/activities.png";
import photosIcon from "../../../../../assets/yahoo/photos.png";
import "../../../../../styles/desktop/apps/yahoo/yahoo-conversation-window/yahoo-conversation-header.css";

const MENU_ITEMS = ["Conversation", "Edit", "View", "Actions", "Help"];
const CONVERSATION_MENU_ITEMS = [
  { label: "New", shortcut: "Ctrl+N" },
  { type: "separator" },
  { label: "Send", shortcut: "Alt+S" },
  { type: "separator" },
  { label: "Save As...", shortcut: "Ctrl+S" },
  { label: "Print...", shortcut: "Ctrl+P" },
  { type: "separator" },
  { label: "Preferences", shortcut: "Ctrl+Shift+P" },
  { label: "Privacy Options", shortcut: "" },
  { type: "separator" },
  { label: "Close", shortcut: "Esc" },
];
const EDIT_MENU_ITEMS = [
  { label: "Undo", shortcut: "Ctrl+Z" },
  { label: "Cut", shortcut: "Ctrl+X" },
  { label: "Copy", shortcut: "Ctrl+C" },
  { label: "Paste", shortcut: "Ctrl+V" },
  { type: "separator" },
  { label: "Delete", shortcut: "Del" },
  { label: "Select All", shortcut: "Ctrl+A" },
  { type: "separator" },
  { label: "Previous Message", shortcut: "Up" },
  { label: "Next Message", shortcut: "Down" },
  { type: "separator" },
  { label: "Search the Web", shortcut: "Ctrl+E" },
];
const VIEW_MENU_ITEMS = [
  { label: "Conversation Toolbar", isChecked: true },
  { label: "Audibles Toolbar", isChecked: true },
  { label: "Text Formatting Toolbar", isChecked: true },
  { type: "separator" },
  { label: "Timestamps", shortcut: "F2" },
  { label: "Recent Messages", shortcut: "F3" },
  { type: "separator" },
  { label: "Display Image", shortcut: "F7", isChecked: true },
  { label: "My Display Image Options", hasSubmenu: true },
];
const ACTIONS_MENU_ITEMS = [
  { label: "Contact Options", hasSubmenu: true },
  { type: "separator" },
  { label: "Start Video Call...", shortcut: "Ctrl+J", isDisabled: true },
  { label: "Start Voice Call...", shortcut: "Ctrl+L", isDisabled: true },
  { label: "Send an SMS Message...", shortcut: "Ctrl+T" },
  { label: "Send an Email...", shortcut: "Ctrl+Y", isDisabled: true },
  { type: "separator" },
  { label: "Send My Contact Details...", shortcut: "Ctrl+Shift+C" },
  { label: "Send My Messenger List...", shortcut: "Ctrl+Shift+M" },
  { label: "Request Contact Details", shortcut: "Ctrl+Shift+R" },
  { type: "separator" },
  { label: "Buzz", shortcut: "Ctrl+G" },
  { type: "separator" },
  { label: "Send a File..." },
  { label: "Share Photos..." },
  { label: "Choose Activity..." },
  { label: "Invite to Conference..." },
  { type: "separator" },
  { label: "More Actions", hasSubmenu: true },
];
const CONTACT_OPTIONS_MENU_ITEMS = [
  { label: "Add to Messenger List...", shortcut: "Ctrl+Shift+A", isDisabled: true },
  { label: "Ignore...", isDisabled: true },
  { type: "separator" },
  { label: "Stealth Settings", hasSubmenu: true },
  { label: "Contact Details", shortcut: "Ctrl+Shift+V" },
  { label: "View Profile" },
  { label: "Conversation History", shortcut: "Alt+Shift+V" },
  { label: "Ringtone", hasSubmenu: true },
];
const HELP_MENU_ITEMS = [
  { label: "Messenger Help", shortcut: "F1" },
  { label: "Set up Video and Voice" },
  { type: "separator" },
  { label: "Report Abuse" },
  { type: "separator" },
  { label: "About Yahoo! Messenger" },
];
const DROPDOWN_MENUS = {
  Conversation: CONVERSATION_MENU_ITEMS,
  Edit: EDIT_MENU_ITEMS,
  View: VIEW_MENU_ITEMS,
  Actions: ACTIONS_MENU_ITEMS,
  Help: HELP_MENU_ITEMS,
};
const SUBMENUS = {
  Actions: {
    "Contact Options": CONTACT_OPTIONS_MENU_ITEMS,
  },
};
const TOOL_ITEMS = [
  { id: "video", label: "Video Call", icon: videoCallIcon, isFaded: true },
  { id: "voice", label: "Voice Call", icon: voiceCallIcon, isDivider: true },
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
  const [activeMenu, setActiveMenu] = useState(null);
  const [menuLeft, setMenuLeft] = useState(0);
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const menuBarRef = useRef(null);
  const menuRef = useRef(null);

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

  useEffect(() => {
    if (!activeMenu) return;
    const handleOutsideClick = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      if (menuBarRef.current?.contains(event.target)) return;
      setActiveMenu(null);
      setActiveSubmenu(null);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [activeMenu]);

  useEffect(() => {
    if (!activeMenu) {
      setActiveSubmenu(null);
    }
  }, [activeMenu]);

  const handleMenuClick = (label, event) => {
    if (!DROPDOWN_MENUS[label]) {
      setActiveMenu(null);
      setActiveSubmenu(null);
      return;
    }
    setActiveMenu((prev) => (prev === label ? null : label));
    setMenuLeft(event.currentTarget.offsetLeft);
    setActiveSubmenu(null);
  };

  return (
    <div className="yahoo-conversation-header" onMouseDown={(event) => event.stopPropagation()}>
      <div className="yahoo-conversation-menu" ref={menuBarRef}>
        {MENU_ITEMS.map((item) => (
          <button
            key={item}
            type="button"
            className={`yahoo-conversation-menu-item${activeMenu === item ? " is-active" : ""}`}
            onClick={(event) => handleMenuClick(item, event)}
          >
            {item}
          </button>
        ))}
        {activeMenu ? (
          <div
            className="yahoo-conversation-menu-dropdown"
            style={{ left: menuLeft }}
            ref={menuRef}
          >
            {DROPDOWN_MENUS[activeMenu].map((entry, index) =>
              entry.type === "separator" ? (
                <div key={`separator-${index}`} className="yahoo-conversation-menu-separator" />
              ) : (
                <button
                  key={entry.label}
                  type="button"
                  className={`yahoo-conversation-dropdown-item${
                    entry.isDisabled ? " is-disabled" : ""
                  }`}
                  onMouseEnter={(event) => {
                    if (!entry.hasSubmenu) {
                      setActiveSubmenu(null);
                      return;
                    }
                    const items = SUBMENUS[activeMenu]?.[entry.label];
                    if (!items) {
                      setActiveSubmenu(null);
                      return;
                    }
                    setActiveSubmenu({
                      label: entry.label,
                      top: event.currentTarget.offsetTop,
                    });
                  }}
                  onClick={() => {
                    if (entry.isDisabled) return;
                    if (entry.hasSubmenu) return;
                    setActiveMenu(null);
                    setActiveSubmenu(null);
                  }}
                >
                  <span
                    className={`yahoo-conversation-dropdown-marker${
                      entry.isChecked ? " is-checked" : ""
                    }`}
                    aria-hidden="true"
                  />
                  <span className="yahoo-conversation-dropdown-label">{entry.label}</span>
                  <span className="yahoo-conversation-dropdown-shortcut">
                    {entry.shortcut}
                  </span>
                  {entry.hasSubmenu ? (
                    <span className="yahoo-conversation-dropdown-submenu" aria-hidden="true" />
                  ) : (
                    <span className="yahoo-conversation-dropdown-submenu is-empty" aria-hidden="true" />
                  )}
                </button>
              )
            )}
            {activeSubmenu && SUBMENUS[activeMenu]?.[activeSubmenu.label] ? (
              <div
                className="yahoo-conversation-submenu"
                
              >
                {SUBMENUS[activeMenu][activeSubmenu.label].map((entry, index) =>
                  entry.type === "separator" ? (
                    <div key={`submenu-separator-${index}`} className="yahoo-conversation-menu-separator" />
                  ) : (
                    <button
                      key={entry.label}
                      type="button"
                      className={`yahoo-conversation-dropdown-item${
                        entry.isDisabled ? " is-disabled" : ""
                      }`}
                      onMouseEnter={() => {
                        if (entry.hasSubmenu) return;
                      }}
                      onClick={() => {
                        if (entry.isDisabled) return;
                        setActiveMenu(null);
                        setActiveSubmenu(null);
                      }}
                    >
                      <span
                        className={`yahoo-conversation-dropdown-marker${
                          entry.isChecked ? " is-checked" : ""
                        }`}
                        aria-hidden="true"
                      />
                      <span className="yahoo-conversation-dropdown-label">{entry.label}</span>
                      <span className="yahoo-conversation-dropdown-shortcut">
                        {entry.shortcut}
                      </span>
                      {entry.hasSubmenu ? (
                        <span className="yahoo-conversation-dropdown-submenu" aria-hidden="true" />
                      ) : (
                        <span className="yahoo-conversation-dropdown-submenu is-empty" aria-hidden="true" />
                      )}
                    </button>
                  )
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="yahoo-conversation-tools">
        {TOOL_ITEMS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`yahoo-conversation-tool is-${tool.id}${
              tool.isFaded ? " is-faded" : ""
            }${
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
