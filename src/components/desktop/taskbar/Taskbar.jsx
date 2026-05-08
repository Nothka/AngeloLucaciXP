import React, { useState, useRef, useEffect } from "react";
import StartButton from "./buttons/StartButton";
import Tray from "./Tray";
import StartMenu from "./startmenu/StartMenu";
import TaskbarApp from "./TaskbarApp";
import "../../../styles/desktop/taskbar/taskbar.css";

const Taskbar = ({
  time,
  onToggleWelcome,
  windows,
  onMinimize,
  onBringToFront,
  openApp,
  extraApps = [],
  onExtraAppClick,
  onLogOff,
  onShutdown,
  onOpenRunDialog,
}) => {
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const startMenuRef = useRef(null);

  const handleToggleStartMenu = () => {
    setIsStartMenuOpen((prev) => !prev);
  };

  const closeStartMenu = () => {
    setIsStartMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        startMenuRef.current &&
        !startMenuRef.current.contains(event.target)
      ) {
        closeStartMenu();
      }
    };

    if (isStartMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isStartMenuOpen]);

  const handleTaskbarAppClick = (windowId) => {
    const clickedWindow = windows.find((w) => w.id === windowId);
    if (!clickedWindow) return;

    const maxZIndex = Math.max(0, ...windows.map((w) => w.zIndex));
    const isTopmost = clickedWindow.zIndex === maxZIndex;

    if (isTopmost && !clickedWindow.minimized) {
      onMinimize(windowId);
    } else {
      onBringToFront(windowId);
    }
  };

  const maxZIndex = Math.max(0, ...windows.map((w) => w.zIndex));
  const activeExtraAppWindowIds = new Set(
    extraApps
      .filter((app) => app.isActive && app.ownerWindowId)
      .map((app) => app.ownerWindowId)
  );

  return (
    <div className="taskbar">
      <div className="taskbar-start" ref={startMenuRef}>
        <StartButton
          onClick={handleToggleStartMenu}
          isActive={isStartMenuOpen}
        />
        <StartMenu
          isOpen={isStartMenuOpen}
          openApp={openApp}
          closeMenu={closeStartMenu}
          onLogOff={onLogOff}
          onShutdown={onShutdown}
          onOpenRunDialog={onOpenRunDialog}
        />
      </div>

      <div className="taskbar-windows">
        {windows.map((window) => {
          const isWindowTopmost = window.zIndex === maxZIndex && !window.minimized;
          const isActive =
            isWindowTopmost && !activeExtraAppWindowIds.has(window.id);
          return (
            <TaskbarApp
              key={window.id}
              windowId={window.id}
              title={window.title}
              icon={window.icon}
              onClick={handleTaskbarAppClick}
              isActive={isActive}
            />
          );
        })}
        {extraApps.map((app) => (
          <TaskbarApp
            key={`extra-${app.id}`}
            windowId={app.id}
            title={app.title}
            icon={app.icon}
            onClick={onExtraAppClick}
            isActive={app.isActive}
          />
        ))}
      </div>

      <Tray time={time} onToggleWelcome={onToggleWelcome} />
    </div>
  );
};

export default Taskbar;
