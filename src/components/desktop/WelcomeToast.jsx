import React from "react";
import { userProfile } from "../login/User/UserProfile";
import infoIcon from "../../assets/icons/ui/976.ico";
import "../../styles/desktop/welcome-toast.css";

const WelcomeToast = ({ onClose, onOpenAbout, onOpenProjects }) => {
  return (
    <div className="welcome-toast">
      <div className="welcome-toast__header">
        <img src={infoIcon} alt="" className="welcome-toast__icon" />
        <span className="welcome-toast__title">
          Welcome to {userProfile.firstName}
          {userProfile.lastName} XP
        </span>
        <button type="button" className="welcome-toast__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="welcome-toast__body">
        <p className="welcome-toast__text">
          A faithful XP-inspired interface, custom-built to showcase my work and attention to detail.
        </p>

        <p className="welcome-toast__links">
          Get Started:{" "}
          <button
            type="button"
            className="welcome-toast__link"
            onClick={() => {
              if (onOpenAbout) onOpenAbout();
              if (onClose) onClose();
            }}
          >
            About Me
          </button>{" "}
          |{" "}
          <button
            type="button"
            className="welcome-toast__link"
            onClick={() => {
              if (onOpenProjects) onOpenProjects();
              if (onClose) onClose();
            }}
          >
            My Projects
          </button>
        </p>
      </div>
    </div>
  );
};

export default WelcomeToast;
