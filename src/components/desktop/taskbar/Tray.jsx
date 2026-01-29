import React from "react";
import "../../../styles/desktop/taskbar/tray.css";
import TrayIcons from "./TrayIcons";
// Removed: import "../taskbar/useCurrentTime"; // Not needed here

const Tray = ({ time, onToggleWelcome }) => {
  return (
    <div className="tray-content" aria-label="System tray">
      <TrayIcons onToggleWelcome={onToggleWelcome} />
      <span className="time" aria-label="Clock">
        {time}
      </span>
    </div>
  );
};

export default Tray;
