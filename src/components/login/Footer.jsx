import React from "react";
import restartIcon from "../../assets/restart.webp";

const Footer = ({ productName, mobileInstruction, onRestart }) => {
  return (
    <footer className="login-footer">
      <button type="button" className="turn-off" onClick={onRestart}>
        <span className="restart-icon-wrap">
          <img src={restartIcon} alt="Restart" className="restart-icon" />
        </span>
        <div className="restart-text">Restart {productName}</div>
      </button>

      <div className="right-bottom">
        <span className="desktop-bottom-detail">
          After you log on, the system&apos;s yours to explore.
        </span>
        <span className="desktop-bottom-detail">
          Every detail has been designed with a purpose.
        </span>
        <span className="mobile-bottom-detail">{mobileInstruction}</span>
      </div>
    </footer>
  );
};

export default Footer;
