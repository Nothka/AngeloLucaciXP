// src/components/desktop/MenuList.jsx
import React from "react";
import instagramIcon from "../../../../assets/startmenu/instagram.jpeg";
import githubIcon from "../../../../assets/startmenu/github.png";
import linkedinIcon from "../../../../assets/startmenu/linkedin.png";
import commandpromptIcon from "../../../../assets/startmenu/commandprompt.png";
import imageviewerIcon from "../../../../assets/startmenu/imageviewer.webp";
import resumeIcon from "../../../../assets/startmenu/Pdf.png"; // Placeholder
import recentlyUsedIcon from "../../../../assets/startmenu/Recent.webp"; // Placeholder
import chatgptIcon from "../../../../assets/about-me/chatgpt.png";
import geminiIcon from "../../../../assets/about-me/gemini.png";
import gitIcon from "../../../../assets/about-me/git.png";
import adobeCcIcon from "../../../../assets/about-me/adobecc.png";
import davinciIcon from "../../../../assets/startmenu/recentlyused/davinci.png";
import lightroomIcon from "../../../../assets/startmenu/recentlyused/lightroom.png";
import notepadIcon from "../../../../assets/startmenu/recentlyused/notepad.webp";
import minesweeperIcon from "../../../../assets/startmenu/recentlyused/minesweeper.webp";
import yahooIcon from "../../../../assets/startmenu/recentlyused/yahoo.jpeg";
import youtubeIcon from "../../../../assets/startmenu/recentlyused/youtube.jpg";
import gitCopilotIcon from "../../../../assets/about-me/gitcopilot.png";
import vscodeIcon from "../../../../assets/about-me/vscode.jpeg";
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
  { key: "command-prompt", title: "Command Prompt", iconSrc: commandpromptIcon},
  { key: "image-viewer", title: "Image Viewer", iconSrc: imageviewerIcon },
  { key: "resume", title: "My Resume", iconSrc: resumeIcon },
];

const MenuList = ({ openApp, closeMenu }) => {
  const handleItemClick = (item) => {
    if (item.submenu) {
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
