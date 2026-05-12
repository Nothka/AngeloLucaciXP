import React from "react";
import myProjectsIcon from "../../../../assets/icons/apps/myprojects.webp";
import contactMeIcon from "../../../../assets/icons/apps/contact.webp";
import aboutMeIcon from "../../../../assets/icons/apps/about.webp";
import yahooIcon from "../../../../assets/icons/apps/recentlyused/yahoo.jpeg";
import notepadIcon from "../../../../assets/icons/apps/recentlyused/notepad.webp";

const pinnedItems = [
  {
    key: "projects",
    title: "My Projects",
    subtitle: "View my work",
    iconSrc: myProjectsIcon,
  },
  {
    key: "notepad",
    title: "Notepad",
    subtitle: "Edit text files",
    iconSrc: notepadIcon,
  },
  {
    key: "yahoo",
    title: "Yahoo Messenger",
    subtitle: "Chat with friends",
    iconSrc: yahooIcon,
  },
  {
    key: "contact",
    title: "Contact Me",
    subtitle: "Send me a message",
    iconSrc: contactMeIcon,
  },
  { key: "about", title: "About Me", subtitle: null, iconSrc: aboutMeIcon },
];

const PinnedList = ({ openApp, closeMenu }) => {
  return (
    <div className="pinned-list">
      {pinnedItems.map(
        ({ key, title, subtitle, iconSrc, icon, isSeparator }) =>
          isSeparator ? (
            <div key={key} className="start-menu-separator" />
          ) : (
            <div
              key={key}
              className={`menu-item menu-item-left ${
                key === "contact" ? "with-gradient-border" : ""
              }`}
              onClick={() => {
                openApp(title, iconSrc);
                closeMenu();
              }}
            >
              {iconSrc ? (
                <img
                  src={iconSrc}
                  alt=""
                  className="menu-item-icon-img-left"
                  draggable="false"
                />
              ) : (
                <span className={`icon icon-${icon}`}></span>
              )}
              <div className="menu-item-text">
                <span className="menu-item-title">{title}</span>
                {subtitle ? (
                  <span className="menu-item-subtitle">{subtitle}</span>
                ) : null}
              </div>
            </div>
          )
      )}
    </div>
  );
};

export default PinnedList;
