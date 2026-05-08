// src/components/desktop/taskbar/startmenu/StartMenu.jsx
import React from "react";
import MenuList from "./MenuList"; // For the right-side list
import PinnedList from "./PinnedList"; // For the left-side pinned programs
import StartMenuFooter from "./StartMenuFooter";
import StartMenuHeader from "./StartMenuHeader";
import aboutMeIcon from "../../../../assets/startmenu/about.webp";
import resumeIcon from "../../../../assets/startmenu/Pdf.webp";
import myProjectsIcon from "../../../../assets/startmenu/myprojects.webp";
import contactMeIcon from "../../../../assets/startmenu/contact.webp";
import instagramIcon from "../../../../assets/startmenu/instagram.jpeg";
import githubIcon from "../../../../assets/startmenu/github.webp";
import linkedinIcon from "../../../../assets/startmenu/linkedin.webp";
import commandpromptIcon from "../../../../assets/startmenu/commandprompt.webp";
import "../../../../styles/desktop/taskbar/startmenu/startmenu.css";

const allProgramsItems = [
  { key: "about", title: "About Me", iconSrc: aboutMeIcon },
  { key: "resume", title: "My Resume", iconSrc: resumeIcon },
  { key: "projects", title: "My Projects", iconSrc: myProjectsIcon },
  { key: "contact", title: "Contact Me", iconSrc: contactMeIcon },
  { key: "instagram", title: "Instagram", iconSrc: instagramIcon },
  { key: "github", title: "Github", iconSrc: githubIcon },
  { key: "linkedin", title: "LinkedIn", iconSrc: linkedinIcon },
  { key: "command-prompt", title: "Command Prompt", iconSrc: commandpromptIcon },
];

const StartMenu = ({ isOpen, openApp, closeMenu, onLogOff, onShutdown }) => {
  // Render nothing if the menu is not open
  if (!isOpen) return null;

  return (
    <div className="start-menu">
      <StartMenuHeader />

      <div className="start-menu-body">
        {/* 1. Left Column: Pinned Programs & Separator */}
        <div className="start-menu-left">
          <PinnedList openApp={openApp} closeMenu={closeMenu} />
          <div className="start-menu-all-programs">
            <span className="start-menu-all-programs-text">
              All <span className="start-menu-all-programs-accelerator">P</span>rograms
            </span>
          </div>
          <div className="all-programs-menu">
            {allProgramsItems.map((item) => (
              <div
                key={item.key}
                className="all-programs-menu-item"
                onClick={() => {
                  if (openApp && item.title) {
                    openApp(item.title, item.iconSrc);
                  }
                  if (closeMenu) {
                    closeMenu();
                  }
                }}
              >
                <img
                  src={item.iconSrc}
                  alt=""
                  className="all-programs-menu-icon"
                  draggable="false"
                />
                <span>{item.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Right Column: System Links */}
        <div className="start-menu-right">
          <MenuList openApp={openApp} closeMenu={closeMenu} />
        </div>
      </div>

      {/* 3. Footer: Log Off/Shut Down */}
      <StartMenuFooter onLogOff={onLogOff} onShutdown={onShutdown} closeMenu={closeMenu} />
    </div>
  );
};

export default StartMenu;
