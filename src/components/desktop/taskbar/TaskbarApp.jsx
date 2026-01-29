import React from 'react';
import '../../../styles/desktop/taskbar/taskbar-app.css';

const TaskbarApp = ({ windowId, title, icon, onClick, isActive }) => {
  return (
    <button
      className={`taskbar-app ${isActive ? 'active' : ''}`}
      onClick={() => onClick(windowId)}
    >
      {icon && <img src={icon} alt={title} className="taskbar-app-icon" />}
      <span className="taskbar-app-title">{title}</span>
    </button>
  );
};

export default TaskbarApp;
