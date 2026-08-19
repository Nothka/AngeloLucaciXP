import React, { useEffect, useRef, useState } from "react";
import aboutIcon from "../../../assets/icons/apps/about.webp";
import backIcon from "../../../assets/icons/ui/window-controls/Back.webp";
import forwardIcon from "../../../assets/icons/ui/window-controls/Forward.webp";
import myProjectsIcon from "../../../assets/icons/apps/myprojects.webp";
import resumeIcon from "../../../assets/icons/apps/Pdf.webp";
import goIcon from "../../../assets/icons/apps/adressbar/Go.webp";
import linkedinIcon from "../../../assets/icons/apps/linkedin.webp";
import githubIcon from "../../../assets/icons/apps/github.webp";
import instagramIcon from "../../../assets/icons/apps/instagram.jpeg";
import adobeCcIcon from "../../../assets/icons/skills/adobecc.webp";
import arrowIcon from "../../../assets/icons/skills/arrow.webp";
import matlabIcon from "../../../assets/icons/skills/matlab.webp";
import canoeIcon from "../../../assets/icons/skills/canoe.webp";
import chatGptIcon from "../../../assets/icons/skills/chatgpt.webp";
import confluenceIcon from "../../../assets/icons/skills/coonfluence.jpeg";
import doorsIcon from "../../../assets/icons/skills/doors.webp";
import figmaIcon from "../../../assets/icons/skills/figma.webp";
import gitIcon from "../../../assets/icons/skills/git.webp";
import geminiIcon from "../../../assets/icons/skills/gemini.webp";
import gitCopilotIcon from "../../../assets/icons/skills/gitcopilot.webp";
import githubToolIcon from "../../../assets/icons/skills/github.webp";
import tailwindIcon from "../../../assets/icons/skills/tailwind.webp";
import stripeIcon from "../../../assets/icons/skills/stripe.webp";
import firebaseIcon from "../../../assets/icons/skills/firebase.webp";
import axiosIcon from "../../../assets/icons/skills/axios.webp";
import expressIcon from "../../../assets/icons/skills/express.webp";
import ejsIcon from "../../../assets/icons/skills/ejs.webp";
import piniaIcon from "../../../assets/icons/skills/pinia.webp";
import reactIcon from "../../../assets/icons/skills/react.webp";
import strapiIcon from "../../../assets/icons/skills/strapi.webp";
import threeIcon from "../../../assets/icons/skills/three.webp";
import vueIcon from "../../../assets/icons/skills/vue.webp";
import nodeIcon from "../../../assets/icons/skills/node.webp";
import vscodeIcon from "../../../assets/icons/skills/vscode.jpeg";
import minimizeIcon from "../../../assets/icons/ui/window-controls/Minimize.webp";
import maximizeIcon from "../../../assets/icons/ui/window-controls/Maximize.webp";
import closeIcon from "../../../assets/icons/ui/window-controls/Exit.webp";
import ResizeHandles from "../ResizeHandles";
import useWindowResize from "../hooks/useWindowResize";
import { getDesktopPoint } from "../utils/desktopTransform";
import "../../../styles/desktop/window.css";
import "../../../styles/desktop/apps/aboutme.css";

const DEFAULT_SIZE = { width: 860, height: 560 };
const DEFAULT_POSITION = { x: 90, y: 70 };

const ABOUT_SKILLS = [
  "Frontend development with Vue.js, React, JavaScript, HTML5, CSS3",
  "Role-based dashboards, dynamic views, and responsive UI",
  "API integration with Axios, REST APIs, and async data flows",
  "Frontend-backend collaboration, debugging, and API validation",
  "TailwindCSS, Three.js, and interactive web experiences",
  "Node.js, Express.js, Strapi, Firebase, and Stripe",
  "Agile/Scrum delivery, client communication, and testing",
  "Automotive software foundation: validation, test automation, MATLAB/Simulink",
];

const ABOUT_SOFTWARE = [
  { label: "VS Code", icon: vscodeIcon },
  { label: "Git", icon: gitIcon },
  { label: "GitHub", icon: githubToolIcon },
  { label: "Figma", icon: figmaIcon },
  { label: "Adobe CC", icon: adobeCcIcon },
  { label: "Jira / Confluence", icon: confluenceIcon },
  { label: "MATLAB / Simulink", icon: matlabIcon },
  { label: "CANoe / CANape", icon: canoeIcon },
  { label: "Rational DOORS", icon: doorsIcon },
];

const ABOUT_TOOLS = [
  { label: "ChatGPT", icon: chatGptIcon },
  { label: "Google Gemini", icon: geminiIcon },
  { label: "GitHub Copilot", icon: gitCopilotIcon },
];

const ABOUT_FRAMEWORKS = [
  { label: "Vue.js", icon: vueIcon },
  { label: "Pinia", icon: piniaIcon },
  { label: "Vue Router" },
  { label: "Axios", icon: axiosIcon },
  { label: "REST APIs" },
  { label: "React", icon: reactIcon },
  { label: "Node.js", icon: nodeIcon },
  { label: "Express.js", icon: expressIcon },
  { label: "Tailwind CSS", icon: tailwindIcon },
  { label: "Firebase", icon: firebaseIcon },
  { label: "EJS", icon: ejsIcon },
  { label: "Three.js", icon: threeIcon },
  { label: "Strapi", icon: strapiIcon },
  { label: "Stripe", icon: stripeIcon },
];

const AboutMeWindow = ({
  windowId,
  title,
  onClose,
  onMinimize,
  onMaximize,
  zIndex,
  onMouseDown,
  onOpenLinkedIn,
  onOpenGithub,
  onOpenInstagram,
  onOpenResume,
  onOpenProjects,
  isActive = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [collapsedPanels, setCollapsedPanels] = useState({
    social: false,
    skills: false,
    software: false,
    tools: false,
    frameworks: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const windowRef = useRef(null);
  const fileMenuRef = useRef(null);
  const fileButtonRef = useRef(null);
  const viewMenuRef = useRef(null);
  const viewButtonRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const originalPosition = useRef(DEFAULT_POSITION);
  const originalSize = useRef(DEFAULT_SIZE);
  const { startResize } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 640,
    minHeight: 420,
    isMaximized,
    onFocus: () => onMouseDown(windowId),
  });

  useEffect(() => {
    if (isMaximized) {
      originalPosition.current = position;
      originalSize.current = size;
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight - 30 });
    } else {
      setPosition(originalPosition.current);
      setSize(originalSize.current);
    }
  }, [isMaximized]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3300);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseDown = (event) => {
    if (isMaximized || event.button !== 0) return;
    setIsDragging(true);
    const point = getDesktopPoint(event);
    dragOffset.current = {
      x: point.x - position.x,
      y: point.y - position.y,
    };
    onMouseDown(windowId);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (event) => {
    if (!isDragging) return;
    const point = getDesktopPoint(event);
    setPosition({
      x: point.x - dragOffset.current.x,
      y: point.y - dragOffset.current.y,
    });
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (onMaximize) onMaximize(windowId);
  };

  const togglePanel = (panelKey) => {
    setCollapsedPanels((prev) => ({
      ...prev,
      [panelKey]: !prev[panelKey],
    }));
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
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      className={`window about-window ${isActive ? "" : "is-inactive"} ${isMaximized ? "maximized" : ""}`}
      ref={windowRef}
      style={{ top: position.y, left: position.x, zIndex, width: size.width, height: size.height }}
      onMouseDown={() => onMouseDown(windowId)}
    >
      <div className="window-header" onMouseDown={handleMouseDown} onDoubleClick={toggleMaximize}>
        <div className="window-title">
          <img src={aboutIcon} alt="About Me" className="window-title-icon" />
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
        <div className="about-menu-wrapper">
          <button
            ref={fileButtonRef}
            type="button"
            className={`window-menu-btn about-menu-trigger ${isFileMenuOpen ? "is-open" : ""}`}
            onClick={() => {
              setIsViewMenuOpen(false);
              setIsFileMenuOpen((prev) => !prev);
            }}
          >
            File
          </button>
          {isFileMenuOpen ? (
            <div className="about-menu" ref={fileMenuRef}>
              <button type="button" className="about-menu-item is-disabled" disabled>
                Print
              </button>
              <button type="button" className="about-menu-item is-disabled" disabled>
                Print Setup
              </button>
              <div className="about-menu-divider" />
              <button type="button" className="about-menu-item" onClick={handleFileMenuExit}>
                Exit
              </button>
            </div>
          ) : null}
        </div>
        <div className="about-menu-wrapper">
          <button
            ref={viewButtonRef}
            type="button"
            className={`window-menu-btn about-menu-trigger ${isViewMenuOpen ? "is-open" : ""}`}
            onClick={() => setIsViewMenuOpen((prev) => !prev)}
          >
            View
          </button>
          {isViewMenuOpen ? (
            <div className="about-menu" ref={viewMenuRef}>
              <button type="button" className="about-menu-item" onClick={handleViewMenuMaximize}>
                Maximize
              </button>
              <button type="button" className="about-menu-item" onClick={handleViewMenuMinimize}>
                Minimize
              </button>
            </div>
          ) : null}
        </div>
        <button type="button" className="window-menu-btn is-muted">Help</button>
      </div>

      <div className="window-toolbar about-toolbar">
        <div className="window-nav about-nav">
          <div className="window-nav-btn">
            <img src={backIcon} alt="Back" />
            Back
          </div>
          <div className="window-nav-btn">
            <img src={forwardIcon} alt="Forward" />
            Forward
          </div>
          <button
            type="button"
            className="window-nav-btn about-nav-btn"
            onClick={() => onOpenProjects?.()}
          >
            <img src={myProjectsIcon} alt="My Projects" />
            My Projects
          </button>
          <button
            type="button"
            className="window-nav-btn about-nav-btn"
            onClick={() => onOpenResume?.()}
          >
            <img src={resumeIcon} alt="My Resume" />
            My Resume
          </button>
        </div>
      </div>

      <div className="window-address">
        <span className="address-label">Address</span>
        <div className="address-bar">
          <img src={aboutIcon} alt="About Me" />
          <span className="address-bar-text" aria-label="Address bar">
            About Me
          </span>
          {isLoading ? <div className="loading-bar" /> : null}
        </div>
        <div className="address-go">
          <img src={goIcon} alt="Go" />
          <span>Go</span>
        </div>
      </div>

      {isLoading ? (
        <div className="about-loading" />
      ) : (
        <div className="about-body">
          <aside className="about-sidebar">
            <div className={`about-panel ${collapsedPanels.social ? "is-collapsed" : ""}`}>
              <div className="about-panel-header">
                <span>Social Links</span>
                <button
                  type="button"
                  className="about-panel-toggle"
                  onClick={() => togglePanel("social")}
                >
                  <img src={arrowIcon} alt="" />
                </button>
              </div>
              {!collapsedPanels.social ? (
                <div className="about-panel-body">
                  <button type="button" className="about-link" onClick={() => onOpenLinkedIn?.()}>
                    <img src={linkedinIcon} alt="LinkedIn" />
                    LinkedIn
                  </button>
                  <button type="button" className="about-link" onClick={() => onOpenGithub?.()}>
                    <img src={githubIcon} alt="GitHub" />
                    GitHub
                  </button>
                  <button type="button" className="about-link" onClick={() => onOpenInstagram?.()}>
                    <img src={instagramIcon} alt="Instagram" />
                    Instagram
                  </button>
                </div>
              ) : null}
            </div>

            <div className={`about-panel ${collapsedPanels.skills ? "is-collapsed" : ""}`}>
              <div className="about-panel-header">
                <span>Skills</span>
                <button
                  type="button"
                  className="about-panel-toggle"
                  onClick={() => togglePanel("skills")}
                >
                  <img src={arrowIcon} alt="" />
                </button>
              </div>
              {!collapsedPanels.skills ? (
                <div className="about-panel-body">
                  <ul className="about-list">
                    {ABOUT_SKILLS.map((skill) => (
                      <li key={skill} className="about-list-item">
                        <span className="about-dot" />
                        {skill}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className={`about-panel ${collapsedPanels.software ? "is-collapsed" : ""}`}>
              <div className="about-panel-header">
                <span>Workflow</span>
                <button
                  type="button"
                  className="about-panel-toggle"
                  onClick={() => togglePanel("software")}
                >
                  <img src={arrowIcon} alt="" />
                </button>
              </div>
              {!collapsedPanels.software ? (
                <div className="about-panel-body">
                  <ul className="about-list about-list--software">
                    {ABOUT_SOFTWARE.map((tool) => (
                      <li
                        key={tool.label}
                        className={`about-list-item ${tool.icon ? "about-list-item--icon" : ""}`}
                      >
                        {tool.icon ? (
                          <img src={tool.icon} alt="" className="about-list-icon" />
                        ) : (
                          <span className="about-dot" />
                        )}
                        {tool.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className={`about-panel ${collapsedPanels.tools ? "is-collapsed" : ""}`}>
              <div className="about-panel-header">
                <span>Tools</span>
                <button
                  type="button"
                  className="about-panel-toggle"
                  onClick={() => togglePanel("tools")}
                >
                  <img src={arrowIcon} alt="" />
                </button>
              </div>
              {!collapsedPanels.tools ? (
                <div className="about-panel-body">
                  <ul className="about-list">
                    {ABOUT_TOOLS.map((tool) => (
                      <li key={tool.label} className="about-list-item about-list-item--icon">
                        <img src={tool.icon} alt="" className="about-list-icon" />
                        {tool.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className={`about-panel ${collapsedPanels.frameworks ? "is-collapsed" : ""}`}>
              <div className="about-panel-header">
                <span>Frontend Stack</span>
                <button
                  type="button"
                  className="about-panel-toggle"
                  onClick={() => togglePanel("frameworks")}
                >
                  <img src={arrowIcon} alt="" />
                </button>
              </div>
              {!collapsedPanels.frameworks ? (
                <div className="about-panel-body">
                  <ul className="about-list">
                    {ABOUT_FRAMEWORKS.map((framework) => (
                      <li
                        key={framework.label}
                        className={`about-list-item ${framework.icon ? "about-list-item--icon" : ""}`}
                      >
                        {framework.icon ? (
                          <img src={framework.icon} alt="" className="about-list-icon" />
                        ) : (
                          <span className="about-dot" />
                        )}
                        {framework.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="about-content">
            <h1>Angelo Lucaci</h1>
            <div className="about-meta">
              <div><span>Role:</span> Senior Frontend Developer</div>
              <div><span>Location:</span> Arad, Romania</div>
              <div><span>Current:</span> Aumovio, Timisoara</div>
              <div><span>Focus:</span> Vue.js, React, API integration, responsive UI</div>
              <div><span>Languages:</span> English (C2), Romanian (native)</div>
            </div>
            <p>
              I am a frontend-focused software engineer building user-facing web applications with
              Vue.js, React, JavaScript, HTML/CSS, TailwindCSS, and REST API integrations. My current
              work centers on large-scale enterprise platform features, including role-based dashboards,
              dynamic views, async data flows, and interfaces shaped around clear user needs.
            </p>
            <p>
              At Aumovio, I collaborate closely with backend developers to align API contracts, validate
              responses, troubleshoot integration issues, and deliver maintainable frontend features.
              My previous Continental Automotive experience adds a strong engineering foundation in
              debugging, validation, Agile delivery, and structured software quality.
            </p>
            <div className="about-section">
              <h2>Current frontend work</h2>
              <ul>
                <li>Developing Vue.js features with Pinia and Vue Router for role-based dashboards and business workflows.</li>
                <li>Integrating frontend components with backend services through Axios and REST APIs.</li>
                <li>Translating customer and system requirements into usable, maintainable interfaces.</li>
              </ul>
            </div>
            <div className="about-section">
              <h2>Selected web projects</h2>
              <ul>
                <li>Designed, built, and deployed 5+ responsive websites for small businesses, personal brands, and freelance clients.</li>
                <li>Built React and TailwindCSS interfaces with supporting Node.js, Express.js, Strapi, Firebase, and Stripe functionality.</li>
                <li>Created interactive visual elements with Three.js and built AngeloLucaciXP as a custom React portfolio experience.</li>
              </ul>
            </div>
            <div className="about-section about-highlight">
              <h2>Engineering background</h2>
              <p>
                From 2021 to 2025 at Continental Automotive Romania, I worked on software changes,
                testing, bug fixing, validation, stakeholder communication, and Agile delivery across
                structured engineering workflows.
              </p>
            </div>
            <div className="about-section">
              <h2>Education & training</h2>
              <p>
                Bachelor of Science in Systems Engineering from the Polytechnic University of Timisoara
                (2022), plus frontend and full-stack training in React.js, Node.js &amp; Express.js,
                modern JavaScript, advanced CSS/Flexbox, Figma UI/UX design, and SQL.
              </p>
            </div>
          </section>
        </div>
      )}

      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default AboutMeWindow;
