import React from "react";
import avatar from "../../../../assets/logos/login-avatar.webp";
import { fullName} from "../../../login/User/UserProfile";
import "../../../../styles/desktop/taskbar/startmenu/startmenuheader.css";

const StartMenuHeader = () => {
  return (
    <div className="start-menu-header">
      <div
        className="start-menu-user-picture"
        style={{ backgroundImage: `url(${avatar})` }}
      ></div>
      <div className="start-menu-user-meta">
        <div className="start-menu-user-name">{fullName}</div>
      </div>
    </div>
  );
};

export default StartMenuHeader;
