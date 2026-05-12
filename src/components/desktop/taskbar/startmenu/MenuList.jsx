// src/components/desktop/MenuList.jsx
import React from "react";
import instagramIcon from "../../../../assets/icons/apps/instagram.jpeg";
import githubIcon from "../../../../assets/icons/apps/github.webp";
import linkedinIcon from "../../../../assets/icons/apps/linkedin.webp";
import commandpromptIcon from "../../../../assets/icons/apps/commandprompt.webp";
import resumeIcon from "../../../../assets/icons/apps/Pdf.webp"; // Placeholder
import recentlyUsedIcon from "../../../../assets/icons/apps/Recent.webp"; // Placeholder
import wordpadIcon from "../../../../assets/icons/apps/wordpad.webp";
import chatgptIcon from "../../../../assets/icons/skills/chatgpt.webp";
import geminiIcon from "../../../../assets/icons/skills/gemini.webp";
import gitIcon from "../../../../assets/icons/skills/git.webp";
import adobeCcIcon from "../../../../assets/icons/skills/adobecc.webp";
import davinciIcon from "../../../../assets/icons/apps/recentlyused/davinci.webp";
import lightroomIcon from "../../../../assets/icons/apps/recentlyused/lightroom.webp";
import notepadIcon from "../../../../assets/icons/apps/recentlyused/notepad.webp";
import minesweeperIcon from "../../../../assets/icons/apps/recentlyused/minesweeper.webp";
import yahooIcon from "../../../../assets/icons/apps/recentlyused/yahoo.jpeg";
import youtubeIcon from "../../../../assets/icons/apps/recentlyused/youtube.jpg";
import gitCopilotIcon from "../../../../assets/icons/skills/gitcopilot.webp";
import vscodeIcon from "../../../../assets/icons/skills/vscode.jpeg";
import "../../../../styles/desktop/taskbar/startmenu/menulist.css";

const recentlyUsedApps = [
  { key: "chatgpt", title: "ChatGPT", iconSrc: chatgptIcon },
  { key: "gemini", title: "Gemini", iconSrc: geminiIcon },
  { key: "git", title: "Git", iconSrc: gitIcon },
  { key: "adobe-cc", title: "Adobe CC", iconSrc: adobeCcIcon },
  { key: "davinci", title: "DaVinci Resolve", iconSrc: davinciIcon },
  { key: "github-copilot", title: "GitHub Copilot", iconSrc: gitCopilotIcon },
  { key: "vscode", title: "VS Code", iconSrc: vscodeIcon },
  { key: "yahoo", title: "Yahoo", iconSrc: yahooIcon },
  { key: "lightroom", title: "Lightroom", iconSrc: lightroomIcon },
  { key: "minesweeper", title: "Minesweeper", iconSrc: minesweeperIcon },
  { key: "notepad", title: "Notepad", iconSrc: notepadIcon },
  { key: "youtube", title: "YouTube", iconSrc: youtubeIcon },
];

const links = [
  { key: "instagram", title: "Instagram", iconSrc: instagramIcon },
  { key: "github", title: "Github", iconSrc: githubIcon },
  { key: "linkedin", title: "LinkedIn", iconSrc: linkedinIcon },
  { key: "separator1", isSeparator: true },
  {
    key: "recently-used",
    title: "Recently Used",
    iconSrc: recentlyUsedIcon,
    customClass: "recently-used-item",
    submenu: recentlyUsedApps,
  },
  { key: "separator2", isSeparator: true },
  { key: "run", title: "Run...", iconSrc: commandpromptIcon, action: "run-dialog" },
  { key: "notepad", title: "Notepad", iconSrc: notepadIcon },
  { key: "wordpad", title: "WordPad", iconSrc: wordpadIcon },
  { key: "command-prompt", title: "Command Prompt", iconSrc: commandpromptIcon},
  { key: "resume", title: "My Resume", iconSrc: resumeIcon },
];

const MenuList = ({ openApp, closeMenu, onOpenRunDialog }) => {
  const handleItemClick = (item) => {
    if (item.submenu) {
      return;
    }
    if (item.action === "run-dialog") {
      if (closeMenu) {
        closeMenu();
      }
      onOpenRunDialog?.();
      return;
    }
    if (openApp && item.title) {
      openApp(item.title, item.iconSrc);
    }
    if (closeMenu) {
      closeMenu();
    }
  };

  return (
    <div className="menu-list menu-list-right">
      {links.map((item) =>
        item.isSeparator ? (
          <div key={item.key} className="menu-separator-horizontal-recent"></div>
        ) : (
          <div 
            key={item.key} 
            className={`menu-item menu-item-right ${item.customClass || ''}`}
            onClick={() => handleItemClick(item)}
          >
            {item.iconSrc ? (
              <img
                src={item.iconSrc}
                alt=""
                className="menu-item-icon-img"
                draggable="false"
              />
            ) : (
              <span className={`icon icon-${item.icon}`}></span>
            )}
            <span className="menu-item-title">{item.title}</span>
            {item.submenu ? (
              <div
                className="recently-used-menu"
                onClick={(event) => event.stopPropagation()}
              >
                {item.submenu.map((app) => (
                  <div key={app.key} className="recently-used-menu-item">
                    <img src={app.iconSrc} alt="" className="recently-used-icon" />
                    <span>{app.title}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      )}
    </div>
  );
};

export default MenuList;
