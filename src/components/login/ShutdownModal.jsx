import React, { useEffect, useState } from "react";
import restartIcon from "../../assets/icons/ui/restart.webp";
import shutdownIcon from "../../assets/icons/ui/237.ico"; // dacă nu ai încă, poți comenta
import xpLogo from "../../assets/logos/xp-logo.webp";

const ShutdownModal = ({ onClose, onRestart, productName }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  const handleRestart = () => {
    onRestart?.();
  };

  return (
    <>
      <div
        className={`mi-shutdown-overlay ${visible ? "is-visible" : ""}`}
        onClick={onClose}
      />

      <div className={`mi-shutdown-window ${visible ? "is-visible" : ""}`}>
        <div className="mi-shutdown-header">
          <span>Turn off {productName || "XP"}</span>
          <img src={xpLogo} alt="Windows XP" className="mi-shutdown-logo" />
        </div>

        <div className="mi-shutdown-body">
          <button type="button" className="mi-restart-option" onClick={handleRestart}>
            <div className="shutdown-icon-wrap">
              <img src={restartIcon} alt="Restart" className="restart-icon" />
            </div>
            <span>Restart</span>
          </button>

          <button type="button" className="mi-shutdown-option">
            <div className="shutdown-icon-wrap">
              <img src={shutdownIcon} alt="Shut Down" className="shutdown-icon" />
            </div>
            <span>Shut Down</span>
          </button>
        </div>

        <div className="mi-shutdown-footer">
          <button className="mi-shutdown-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};

export default ShutdownModal;
