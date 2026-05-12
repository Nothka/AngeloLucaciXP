import React from "react";
import commandprompt from "../../../../../assets/icons/apps/commandprompt.webp";
import "../../../../../styles/desktop/taskbar/startmenu/apps/comandprompt.css";
function ControlPanel() {
  return (
    <div className="start-menu-app">
      <img src={commandprompt} alt="commandprompt" />
      <p>Control Panel</p>
    </div>
  );
}

export default ControlPanel;
