import React, { useEffect, useRef, useState } from "react";
import aboutIcon from "../../assets/icons/apps/about.webp";
import myProjectsIcon from "../../assets/icons/apps/myprojects.webp";
import contactIcon from "../../assets/icons/apps/contact.webp";
import PdfIcon from "../../assets/icons/apps/Pdf.webp";
import notepadIcon from "../../assets/icons/apps/recentlyused/notepad.webp";

const desktopIcons = [
  { label: "About Me", icon: aboutIcon },
  { label: "My Resume", icon: PdfIcon },
  { label: "My Projects", icon: myProjectsIcon },
  { label: "Contact Me", icon: contactIcon },
  { label: "ReadMe", icon: notepadIcon, action: "open-readme" },
];

const DesktopIcons = ({ openApp, onOpenReadme, selectionRect, isSelecting }) => {
  const [activeIcon, setActiveIcon] = useState(null);
  const [selectedIcons, setSelectedIcons] = useState([]);
  const iconRefs = useRef({});

  const handleClick = (label) => {
    setActiveIcon(label);
    setSelectedIcons([label]);
  };

  const handleDoubleClick = (item) => {
    if (item.action === "open-readme") {
      onOpenReadme?.();
      setActiveIcon(null);
      return;
    }
    openApp(item.label, item.icon);
    setActiveIcon(null); // Deselect icon after double click
  };

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      if (!isSelecting || !selectionRect) {
        return;
      }
      if (selectionRect.width < 2 && selectionRect.height < 2) {
        setSelectedIcons([]);
        setActiveIcon(null);
        return;
      }

      const nextSelected = desktopIcons
        .filter((item) => {
          const node = iconRefs.current[item.label];
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return !(
            selectionRect.right < rect.left ||
            selectionRect.left > rect.right ||
            selectionRect.bottom < rect.top ||
            selectionRect.top > rect.bottom
          );
        })
        .map((item) => item.label);
      setSelectedIcons(nextSelected);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [isSelecting, selectionRect]);

  return (
    <div className="desktop-icons">
      {desktopIcons.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`icon ${activeIcon === item.label ? "active" : ""} ${
            selectedIcons.includes(item.label) ? "is-selected" : ""
          }`}
          onClick={() => handleClick(item.label)}
          onDoubleClick={() => handleDoubleClick(item)}
          ref={(node) => {
            if (node) {
              iconRefs.current[item.label] = node;
            }
          }}
        >
          <div className="icon-img">
            <img src={item.icon} alt={item.label} />
          </div>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default DesktopIcons;
