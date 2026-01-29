import React, { useEffect, useRef, useState } from "react";
import aboutIcon from "../../assets/startmenu/about.png";
import myProjectsIcon from "../../assets/startmenu/myprojects.png";
import contactIcon from "../../assets/startmenu/contact.png";
import PdfIcon from "../../assets/startmenu/pdf.png";

const desktopIcons = [
  { label: "About Me", icon: aboutIcon },
  { label: "My Resume", icon: PdfIcon },
  { label: "My Projects", icon: myProjectsIcon },
  { label: "Contact Me", icon: contactIcon },
];

const DesktopIcons = ({ openApp, selectionRect, isSelecting }) => {
  const [activeIcon, setActiveIcon] = useState(null);
  const [selectedIcons, setSelectedIcons] = useState([]);
  const iconRefs = useRef({});

  const handleClick = (label) => {
    setActiveIcon(label);
    setSelectedIcons([label]);
  };

  const handleDoubleClick = (label, icon) => {
    openApp(label, icon);
    setActiveIcon(null); // Deselect icon after double click
  };

  useEffect(() => {
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
  }, [isSelecting, selectionRect]);

  return (
    <div className="desktop-icons">
      {desktopIcons.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`icon ${activeIcon === item.label ? "active" : ""} ${selectedIcons.includes(item.label) ? "is-selected" : ""}`}
          onClick={() => handleClick(item.label)}
          onDoubleClick={() => handleDoubleClick(item.label, item.icon)}
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
