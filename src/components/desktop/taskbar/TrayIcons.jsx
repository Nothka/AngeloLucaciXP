import React from "react";
import trayIcon from "../../../assets/976.ico";
import securityOkIcon from "../../../assets/securityok.webp";
import welcomeIcon from "../../../assets/welcome.webp";
import "../../../styles/desktop/taskbar/tray-icons.css";

const icons = [
  { key: "welcome-toggle", title: "Welcome Center", src: trayIcon, clickable: true },
  { key: "security", title: "Security Center", src: securityOkIcon },
  { key: "welcome-icon", title: "Welcome Center", src: welcomeIcon },
];

const TrayIcons = ({ onToggleWelcome }) => {
  const handleKeyDown = (event, icon) => {
    if (!icon.clickable) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggleWelcome?.();
    }
  };

  return (
    <div className="tray-icons" aria-hidden="true">
      {icons.map((icon) => (
        <img
          key={icon.key}
          src={icon.src || trayIcon}
          className="tray-icon"
          alt={icon.title}
          title={icon.title}
          draggable="false"
          onClick={icon.clickable ? onToggleWelcome : undefined}
          onKeyDown={(e) => handleKeyDown(e, icon)}
          role={icon.clickable ? "button" : undefined}
          aria-label={icon.clickable ? "Toggle welcome message" : undefined}
          tabIndex={icon.clickable ? 0 : undefined}
        />
      ))}
    </div>
  );
};

export default TrayIcons;
