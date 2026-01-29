import React from 'react';
import genericMessengerIcon from '../../../assets/yahoo/generic_messenger.ico';
import '../../../styles/desktop/taskbar/taskbar-app.css';

const TaskbarApp = ({ windowId, title, icon, onClick, isActive }) => {
  const isYahoo = title === 'Yahoo Messenger' || title === 'Yahoo';
  const displayIcon = isActive && isYahoo ? genericMessengerIcon : icon;
  return (
    <button
      className={`taskbar-app ${isActive ? 'active' : ''}`}
      onClick={() => onClick(windowId)}
    >
      {displayIcon && <img src={displayIcon} alt={title} className="taskbar-app-icon" />}
      <span className="taskbar-app-title">{title}</span>
    </button>
  );
};

export default TaskbarApp;
