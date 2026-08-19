import React from "react";
import logoffIcon from "../../../../assets/icons/ui/logoff.webp";
import shutdownIcon from "../../../../assets/icons/ui/shutdown.webp";
import logoffSound from "../../../../assets/audio/windows-xp-logoff.mp3";
import "../../../../styles/desktop/taskbar/startmenu/startmenufooter.css";

const StartMenuFooter = ({ onLogOff, onShutdown, closeMenu }) => {
  return (
    <div className="start-menu-footer">
      <button
        type="button"
        className="start-menu-footer-btn"
        onClick={() => {
          if (closeMenu) closeMenu();
          const audio = new Audio(logoffSound);
          audio.volume = 0.9;
          audio.play().catch(() => {});
          if (onLogOff) onLogOff();
        }}
      >
        <span className="footer-icon-box footer-logoff">
          <img src={logoffIcon} alt="" className="footer-icon-image" />
        </span>
        <span className="footer-text">Log Off</span>
      </button>
      <button
        type="button"
        className="start-menu-footer-btn"
        onClick={() => {
          if (closeMenu) closeMenu();
          // Only opens the Turn Off dialog — the sound plays on confirmation.
          if (onShutdown) onShutdown();
        }}
      >
        <span className="footer-icon-box footer-shutdown">
          <img src={shutdownIcon} alt="" className="footer-icon-image" />
        </span>
        <span className="footer-text">Turn Off Computer</span>
      </button>
    </div>
  );
};

export default StartMenuFooter;
