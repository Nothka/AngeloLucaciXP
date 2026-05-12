import React, { useState, useRef, useEffect } from "react";
import myProjectsIcon from "../../../assets/icons/apps/myprojects.webp";
import backIcon from "../../../assets/icons/ui/window-controls/Back.webp";
import forwardIcon from "../../../assets/icons/ui/window-controls/Forward.webp";
import favoritesIcon from "../../../assets/icons/ui/window-controls/Favorites.webp";
import homeIcon from "../../../assets/icons/ui/window-controls/home.webp";
import minimizeIcon from "../../../assets/icons/ui/window-controls/Minimize.webp";
import maximizeIcon from "../../../assets/icons/ui/window-controls/Maximize.webp";
import closeIcon from "../../../assets/icons/ui/window-controls/Exit.webp";
import myURLIcon from "../../../assets/icons/ui/window-controls/URL.webp"
import goIcon from "../../../assets/icons/apps/adressbar/Go.webp";
import addIcon from "../../../assets/images/projects/add.webp";
import basicUiIcon from "../../../assets/images/projects/basic-ui.webp";
import bookmarkIcon from "../../../assets/images/projects/bookmark.webp";
import chatIcon from "../../../assets/images/projects/chat.webp";
import heartIcon from "../../../assets/images/projects/heart.webp";
import sendIcon from "../../../assets/images/projects/send.webp";
import settingIcon from "../../../assets/images/projects/setting.webp";
import videoIcon from "../../../assets/images/projects/video.webp";
import profilePhotoAsset from "../../../assets/images/projects/profilepic.webp";
import ResizeHandles from "../ResizeHandles";
import useWindowResize from "../hooks/useWindowResize";
import { getDesktopPoint } from "../utils/desktopTransform";
import "../../../styles/desktop/window.css";
import "../../../styles/desktop/apps/myprojects.css";

const localProjectImages = import.meta.glob(
  "../../../assets/images/projects/*.{png,jpg,jpeg,webp}",
  { eager: true, import: "default" }
);
const localProjectAssets = Object.entries(localProjectImages).reduce((acc, [path, src]) => {
  const filename = path.split("/").pop();
  if (!filename) return acc;
  const key = filename.replace(/\.[^.]+$/, "").toLowerCase();
  acc[key] = src;
  return acc;
}, {});
const localProjectList = Object.keys(localProjectImages)
  .sort()
  .map((path) => localProjectImages[path]);

const getProjectAsset = (key, fallback, listIndex) => {
  if (localProjectAssets[key]) return localProjectAssets[key];
  if (Number.isInteger(listIndex) && localProjectList[listIndex]) {
    return localProjectList[listIndex];
  }
  return fallback;
};

const MyProjectWindow = ({
  windowId,
  title,
  children,
  onClose,
  onMinimize,
  onMaximize,
  zIndex,
  onMouseDown,
  isActive = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 60, y: 60 });
  const [size, setSize] = useState({ width: 780, height: 520 });
  const windowRef = useRef(null);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Added loading state
  const fileMenuRef = useRef(null);
  const fileButtonRef = useRef(null);
  const viewMenuRef = useRef(null);
  const viewButtonRef = useRef(null);
  const profilePhoto = getProjectAsset(
    "profilepic",
    profilePhotoAsset,
    0
  );
  const profileNavIcon = getProjectAsset(
    "proffile ig-icon",
    getProjectAsset(
      "profile ig-icon",
      getProjectAsset("profile-ig-icon", profilePhoto)
    )
  );
  const navItems = [
    { label: "Home", icon: basicUiIcon },
    { label: "Search", icon: sendIcon },
    { label: "Explore", icon: bookmarkIcon },
    { label: "Reels", icon: videoIcon },
    { label: "Messages", icon: chatIcon },
    { label: "Notifications", icon: heartIcon },
    { label: "Create", icon: addIcon },
  ];
  const projects = [
    {
      id: "portfolio",
      title: "Portfolio Website",
      storyLabel: "Portfolio",
      storyImage: getProjectAsset(
        "portfolio-story",
        getProjectAsset("portfolio", "https://picsum.photos/seed/portfolio/120/120", 1),
        1
      ),
      image: getProjectAsset("portfolio", "https://picsum.photos/seed/portfolio/540/540", 1),
      liveUrl: "https://websiteprojectangelolucaci.netlify.app/",
      repoUrl: "",
    },
    {
      id: "apple",
      title: "Apple Website",
      storyLabel: "Apple",
      storyImage: getProjectAsset(
        "applewebsite",
        "https://picsum.photos/seed/apple/120/120",
        2
      ),
      image: getProjectAsset("applewebsite", "https://picsum.photos/seed/apple/540/540", 2),
      liveUrl: "",
      repoUrl: "https://github.com/Nothka/AppleWebsite",
    },
  ];
  const projectTiles = projects.filter((project) => project.liveUrl);
  const storyProjects = projects.filter((project) => project.repoUrl).slice(0, 1);
  const instagramStats = {
    posts: projectTiles.length,
    followers: 905,
    following: 489,
  };
  const tabs = [
    { id: "posts", label: "Posts", icon: null, iconClass: "is-grid" },
    { id: "reels", label: "Reels", icon: videoIcon },
    { id: "saved", label: "Saved", icon: bookmarkIcon },
  ];
  const { startResize } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 400,
    minHeight: 300,
    isMaximized,
    onFocus: () => onMouseDown(windowId),
  });

  // Store the offset of the mouse from the top-left of the window
  const dragOffset = useRef({ x: 0, y: 0 });
  const originalPosition = useRef({ x: 60, y: 60 });
  const originalSize = useRef({ width: 780, height: 520 });

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3300); // 3 seconds, matching the progress animation
    return () => clearTimeout(timer);
  }, []);


  useEffect(() => {
    if (isMaximized) {
      originalPosition.current = position;
      originalSize.current = size;
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight - 30 }); // -30 for taskbar
    } else {
      setPosition(originalPosition.current);
      setSize(originalSize.current);
    }
  }, [isMaximized]);

  const handleMouseDown = (e) => {
    if (isMaximized || e.button !== 0) return; // Prevent dragging when maximized or not left-clicked

    setIsDragging(true);
    const point = getDesktopPoint(e);
    // Record the offset between the mouse position and the window's top-left corner.
    dragOffset.current = {
      x: point.x - position.x,
      y: point.y - position.y,
    };
    onMouseDown(windowId); // Bring window to front
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const point = getDesktopPoint(e);
    // Set the new position of the window based on the current mouse position and the initial offset.
    setPosition({
      x: point.x - dragOffset.current.x,
      y: point.y - dragOffset.current.y,
    });
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (onMaximize) onMaximize(windowId);
  };

  useEffect(() => {
    if (!isViewMenuOpen && !isFileMenuOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (fileMenuRef.current?.contains(event.target)) return;
      if (fileButtonRef.current?.contains(event.target)) return;
      if (viewMenuRef.current?.contains(event.target)) return;
      if (viewButtonRef.current?.contains(event.target)) return;
      setIsViewMenuOpen(false);
      setIsFileMenuOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsViewMenuOpen(false);
        setIsFileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isViewMenuOpen, isFileMenuOpen]);

  const handleViewMenuMaximize = () => {
    if (!isMaximized) {
      setIsMaximized(true);
      onMaximize?.(windowId);
    }
    setIsViewMenuOpen(false);
  };

  const handleViewMenuMinimize = () => {
    setIsViewMenuOpen(false);
    onMinimize?.(windowId);
  };

  const handleFileMenuExit = () => {
    setIsFileMenuOpen(false);
    onClose?.(windowId);
  };

  useEffect(() => {
    if (isDragging) {
      // Attach listeners to the document to capture mouse movement anywhere on the screen.
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    // Cleanup function to remove the listeners when the component unmounts or dragging stops.
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    // Re-run the effect only when `isDragging` changes.
  }, [isDragging]);

  const handleOpenLink = (url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const getStoryLink = (project) => project.repoUrl;
  const getTileLink = (project) => project.liveUrl;

  return (
    <div
      className={`window myprojects-window ${isActive ? "" : "is-inactive"} ${isMaximized ? "maximized" : ""}`}
      ref={windowRef}
      style={{ top: position.y, left: position.x, zIndex, width: size.width, height: size.height }}
      onMouseDown={() => onMouseDown(windowId)}
    >
      <div className="window-header" onMouseDown={handleMouseDown} onDoubleClick={toggleMaximize}>
        <div className="window-title">
          <img src={myProjectsIcon} alt="My Projects" className="window-title-icon" />
          <span>{title}</span>
        </div>
        <div className="window-buttons">
          <button className="window-btn minimize" onClick={() => onMinimize(windowId)}>
            <img src={minimizeIcon} alt="Minimize" />
          </button>
          <button className="window-btn maximize" onClick={toggleMaximize}>
            <img src={maximizeIcon} alt="Maximize" />
          </button>
          <button className="window-btn close" onClick={() => onClose(windowId)}>
            <img src={closeIcon} alt="Close" />
          </button>
        </div>
      </div>

      <div className="window-menu-bar">
        <div className="projects-menu-wrapper">
          <button
            ref={fileButtonRef}
            type="button"
            className={`window-menu-btn projects-menu-trigger ${isFileMenuOpen ? "is-open" : ""}`}
            onClick={() => {
              setIsViewMenuOpen(false);
              setIsFileMenuOpen((prev) => !prev);
            }}
          >
            File
          </button>
          {isFileMenuOpen ? (
            <div className="projects-menu" ref={fileMenuRef}>
              <button type="button" className="projects-menu-item is-disabled" disabled>
                New Window
              </button>
              <button type="button" className="projects-menu-item is-disabled" disabled>
                Save As...
              </button>
              <button type="button" className="projects-menu-item is-disabled" disabled>
                Page Setup...
              </button>
              <button type="button" className="projects-menu-item is-disabled" disabled>
                Print...
              </button>
              <div className="projects-menu-divider" />
              <button type="button" className="projects-menu-item" onClick={handleFileMenuExit}>
                Exit
              </button>
            </div>
          ) : null}
        </div>
        <div className="projects-menu-wrapper">
          <button
            ref={viewButtonRef}
            type="button"
            className={`window-menu-btn projects-menu-trigger ${isViewMenuOpen ? "is-open" : ""}`}
            onClick={() => setIsViewMenuOpen((prev) => !prev)}
          >
            View
          </button>
          {isViewMenuOpen ? (
            <div className="projects-menu" ref={viewMenuRef}>
              <button type="button" className="projects-menu-item" onClick={handleViewMenuMaximize}>
                Maximize
              </button>
              <button type="button" className="projects-menu-item" onClick={handleViewMenuMinimize}>
                Minimize
              </button>
            </div>
          ) : null}
        </div>
        <div className="window-menu-btn is-muted">Tools</div>
        <div className="window-menu-btn is-muted">Help</div>
      </div>

      <div className="window-toolbar">
        <div className="window-nav">
           <div className="window-nav-btn">
            <img src={homeIcon} alt="Home" />
            Home
          </div>
          <div className="window-nav-btn">
            <img src={backIcon} alt="Back" />
            Back
          </div>
          <div className="window-nav-btn">
            <img src={forwardIcon} alt="Forward" />
            Forward
          </div>
          <div className="window-nav-btn">
            <img src={favoritesIcon} alt="Favorites" />
            Favorites
          </div>
        </div>
      </div>

      <div className="window-address">
        <span className="address-label">Address</span>
        <div className="address-bar">
          <img src={myURLIcon} alt="Address home" />
          <span className="address-bar-text" aria-label="Address bar">
            https://www.myprojects.com
          </span>
          {isLoading && <div className="loading-bar"></div>} {/* Added loading bar */}
        </div>
        <div className="address-go">
          <img src={goIcon} alt="Go" />
          <span>Go</span>
        </div>
      </div>

      {isLoading ? (
        <div className="projects-loading" />
      ) : (
        <div className="window-content projects-content">
          <div className="projects-ig">
            <aside className="projects-ig-sidebar">
              <div className="projects-ig-logo">Instagram</div>
              <nav className="projects-ig-nav">
                {navItems.map((item) => (
                  <button key={item.label} type="button" className="projects-ig-nav-item">
                    <span className="projects-ig-icon" aria-hidden="true">
                      <img src={item.icon} alt="" className="projects-ig-nav-icon" />
                    </span>
                    <span className="projects-ig-nav-label">{item.label}</span>
                  </button>
                ))}
                <button type="button" className="projects-ig-nav-item is-active">
                  <span className="projects-ig-icon" aria-hidden="true">
                    <img src={profileNavIcon} alt="" className="projects-ig-nav-avatar" />
                  </span>
                  <span className="projects-ig-nav-label">Profile</span>
                </button>
              </nav>
              <button type="button" className="projects-ig-footer">
                <span className="projects-ig-footer-icon" aria-hidden="true" />
                <span className="projects-ig-footer-label">More</span>
              </button>
            </aside>

            <main className="projects-ig-main">
              <div className="projects-ig-profile">
                <div className="projects-profile-ring">
                  <span className="projects-profile-note">Note...</span>
                  <img src={profilePhoto} alt="Angelo Lucaci" className="projects-profile-photo" />
                </div>
                <div className="projects-ig-profile-info">
                  <div className="projects-ig-username-row">
                    <span className="projects-ig-username">angelo.lucaci</span>
                    <img src={settingIcon} alt="" className="projects-ig-settings-icon" />
                  </div>
                  <div className="projects-ig-actions">
                    <button type="button" className="projects-ig-button">Edit Profile</button>
                    <button type="button" className="projects-ig-button">View archive</button>
                  </div>
                  <div className="projects-ig-stats">
                    <span><strong>{instagramStats.posts}</strong> posts</span>
                    <span><strong>{instagramStats.followers}</strong> followers</span>
                    <span><strong>{instagramStats.following}</strong> following</span>
                  </div>
                  <div className="projects-ig-bio">
                    Angelo Lucaci
                    <br />
                    Mid Software Developer · Arad, Romania
                    <br />
                    Automotive software + web apps (React, Node, Tailwind, MATLAB/Simulink)
                  </div>
                </div>
              </div>

              <div className="projects-stories">
                {storyProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="project-story"
                    onClick={() => handleOpenLink(getStoryLink(project))}
                  >
                    <span className="project-story-ring">
                      <img src={project.storyImage} alt="" className="project-story-avatar" />
                    </span>
                    <span className="project-story-label">{project.storyLabel}</span>
                  </button>
                ))}
              </div>

              <div className="projects-ig-tabs">
                {tabs.map((tab, index) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`projects-ig-tab ${index === 0 ? "is-active" : ""}`}
                    aria-label={tab.label}
                  >
                    {tab.icon ? (
                      <img src={tab.icon} alt="" className="projects-ig-tab-icon" />
                    ) : (
                      <span className={`projects-ig-tab-icon ${tab.iconClass}`} aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>

              <div className="projects-grid">
                {projectTiles.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="project-tile"
                    onClick={() => handleOpenLink(getTileLink(project))}
                  >
                    <img src={project.image} alt={project.title} />
                    <span className="project-tile-overlay">{project.title}</span>
                  </button>
                ))}
              </div>
            </main>
          </div>
        </div>
      )}
      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default MyProjectWindow;
