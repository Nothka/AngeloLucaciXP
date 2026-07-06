import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import warzoneIcon from "../../../assets/icons/apps/warzone.svg";
import storeBackground from "../../../assets/images/apps/warzone/store-reference.webp";
import careerCharacterVideo from "../../../assets/videos/warzone-career.mp4";
import careerCharacterFallback from "../../../assets/images/apps/warzone/career-character-fallback.webp";
import minimizeIcon from "../../../assets/icons/ui/window-controls/Minimize.webp";
import maximizeIcon from "../../../assets/icons/ui/window-controls/Maximize.webp";
import closeIcon from "../../../assets/icons/ui/window-controls/Exit.webp";
import ResizeHandles from "../ResizeHandles";
import useWindowResize from "../hooks/useWindowResize";
import { getDesktopPoint } from "../utils/desktopTransform";
import "../../../styles/desktop/window.css";
import "../../../styles/desktop/apps/warzone.css";

const DEFAULT_SIZE = { width: 1360, height: 760 };
const DEFAULT_POSITION = { x: 52, y: 32 };

const TOP_TABS = ["PLAY", "WEAPONS", "OPERATORS", "BATTLE PASS", "EVENTS", "CAREER", "STORE"];
const STORE_SEGMENTS = ["GOBBLEGUMS", "OPERATORS", "BLUEPRINTS", "WISHLIST", "MY BUNDLES"];
const CAREER_SECTIONS = ["PROGRESSION", "CHALLENGES", "STATS", "CUSTOMIZE"];

const FEATURED_BUNDLES = {
  hero: {
    title: "ULTRA SKIN: NIGHT RAID",
    price: "2800",
    label: "TRACER PACK",
    ctaPrimary: "VIEW BUNDLE",
    ctaSecondary: "PURCHASE",
  },
  sideTop: {
    title: "TRACER PACK: THE REPLACER",
    price: "2400",
  },
  sideBottomLeft: {
    title: "MASTERCRAFT: CORRUPTED",
    price: "2800",
  },
  sideBottomRight: {
    title: "ARACHNID'S MARK",
    price: "$4.99",
  },
};

const TRENDING_BUNDLES = [
  { title: "CALL OF DUTY LEAGUE", tag: "TRENDING" },
  { title: "CATATONIA", tag: "NEW" },
  { title: "NO WEAKNESS", tag: "HOT" },
  { title: "STRANGE SKIES", tag: "LIMITED" },
];

const WarzoneStoreWindow = ({
  windowId,
  zIndex,
  onClose,
  onMinimize,
  onMaximize,
  onMouseDown,
  isActive = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [activeTopTab, setActiveTopTab] = useState("STORE");
  const [activeSegment, setActiveSegment] = useState("OPERATORS");
  const [activeCareerSection, setActiveCareerSection] = useState("PROGRESSION");
  const [statusText, setStatusText] = useState("Store bundles synchronized");
  const [coinBalance] = useState(() => 45 + Math.floor(Math.random() * 30));

  const windowRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const originalPosition = useRef(DEFAULT_POSITION);
  const originalSize = useRef(DEFAULT_SIZE);
  const { startResize } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 980,
    minHeight: 540,
    isMaximized,
    onFocus: () => onMouseDown(windowId),
  });

  const heroStyle = useMemo(
    () => ({
      backgroundImage: `linear-gradient(145deg, rgba(3, 14, 24, 0.72), rgba(3, 14, 24, 0.25)), url(${storeBackground})`,
      backgroundSize: "cover",
      backgroundPosition: "20% center",
    }),
    []
  );

  const sideTopStyle = useMemo(
    () => ({
      backgroundImage: `linear-gradient(145deg, rgba(7, 20, 33, 0.78), rgba(9, 42, 68, 0.25)), url(${storeBackground})`,
      backgroundSize: "cover",
      backgroundPosition: "72% 32%",
    }),
    []
  );

  const sideBottomLeftStyle = useMemo(
    () => ({
      backgroundImage: `linear-gradient(145deg, rgba(39, 19, 6, 0.72), rgba(88, 41, 9, 0.18)), url(${storeBackground})`,
      backgroundSize: "cover",
      backgroundPosition: "74% 60%",
    }),
    []
  );

  const sideBottomRightStyle = useMemo(
    () => ({
      backgroundImage: `linear-gradient(145deg, rgba(10, 18, 29, 0.78), rgba(3, 27, 40, 0.3)), url(${storeBackground})`,
      backgroundSize: "cover",
      backgroundPosition: "88% 66%",
    }),
    []
  );

  const careerStageStyle = useMemo(
    () => ({
      backgroundImage: `
        linear-gradient(90deg, rgba(205, 238, 250, 0.68) 0%, rgba(117, 204, 247, 0.28) 24%, rgba(9, 17, 28, 0) 42%),
        linear-gradient(90deg, rgba(10, 46, 94, 0.4) 32%, rgba(2, 10, 18, 0.2) 56%, rgba(116, 24, 13, 0.42) 74%, rgba(255, 82, 27, 0.45) 100%),
        url(${storeBackground})
      `,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }),
    []
  );

  const isCareerTab = activeTopTab === "CAREER";

  const careerCharacterShellStyle = useMemo(
    () => ({
      backgroundImage: `url(${careerCharacterFallback})`,
    }),
    []
  );

  const handleCloseRequest = () => {
    onClose(windowId);
  };

  const toggleMaximize = () => {
    setIsMaximized((previous) => {
      if (!previous) {
        originalPosition.current = position;
        originalSize.current = size;
        setPosition({ x: 0, y: 0 });
        setSize({ width: window.innerWidth, height: window.innerHeight - 30 });
      } else {
        setPosition(originalPosition.current);
        setSize(originalSize.current);
      }
      return !previous;
    });
    onMaximize?.(windowId);
  };

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

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (event) => {
      if (!isDragging) return;
      const point = getDesktopPoint(event);
      setPosition({
        x: point.x - dragOffset.current.x,
        y: point.y - dragOffset.current.y,
      });
    },
    [isDragging]
  );

  useEffect(() => {
    if (!isDragging) return;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp, isDragging]);

  const handleTopTabClick = (tab) => {
    setActiveTopTab(tab);
    if (tab === "STORE") {
      setStatusText("Store bundles synchronized");
      return;
    }
    if (tab === "CAREER") {
      setStatusText("Career progression synchronized");
      return;
    }
    setStatusText(`${tab} tab opens store preview in this build`);
  };

  const handleSegmentClick = (segment) => {
    setActiveSegment(segment);
    setStatusText(`${segment} bundles loaded`);
  };

  const handleCareerSectionClick = (section) => {
    setActiveCareerSection(section);
    setStatusText(`${section} page updated`);
  };

  return (
    <div
      className={`window warzone-window ${isActive ? "" : "is-inactive"} ${isMaximized ? "maximized" : ""}`}
      ref={windowRef}
      style={{ top: position.y, left: position.x, zIndex, width: size.width, height: size.height }}
      onMouseDown={() => onMouseDown(windowId)}
    >
      <div className="window-header" onMouseDown={handleMouseDown} onDoubleClick={toggleMaximize}>
        <div className="window-title">
          <img src={warzoneIcon} alt="Warzone" className="window-title-icon" />
          <span>Call of Duty: Warzone</span>
        </div>
        <div className="window-buttons">
          <button className="window-btn minimize" onClick={() => onMinimize(windowId)}>
            <img src={minimizeIcon} alt="Minimize" />
          </button>
          <button className="window-btn maximize" onClick={toggleMaximize}>
            <img src={maximizeIcon} alt="Maximize" />
          </button>
          <button className="window-btn close" onClick={handleCloseRequest}>
            <img src={closeIcon} alt="Close" />
          </button>
        </div>
      </div>

      <div className="warzone-shell">
        <div className="warzone-background" style={{ backgroundImage: `url(${storeBackground})` }} />
        <div className="warzone-scanlines" aria-hidden="true" />

        <header className="warzone-topbar">
          <div className="warzone-brand">WARZONE</div>
          <nav className="warzone-main-tabs" aria-label="Warzone Navigation">
            {TOP_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`warzone-main-tab ${activeTopTab === tab ? "is-active" : ""}`}
                onClick={() => handleTopTabClick(tab)}
              >
                {tab}
              </button>
            ))}
          </nav>
          <div className="warzone-meta">
            <span className="warzone-meta-token">61 TOKENS</span>
            <span className="warzone-meta-balance">CP {coinBalance}</span>
          </div>
        </header>

        {isCareerTab ? (
          <main className="warzone-career-layout">
            <section className="warzone-career-stage" style={careerStageStyle}>
              <div className="warzone-career-left-plate" />
              <div className="warzone-career-character">
                <div
                  className="warzone-career-character-shell"
                  aria-hidden="true"
                  style={careerCharacterShellStyle}
                >
                  <video
                    className="warzone-career-character-video"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    poster={careerCharacterFallback}
                  >
                    <source src={careerCharacterVideo} type="video/mp4" />
                  </video>
                </div>
              </div>
              <aside className="warzone-career-rewards">
                <h2>LEVEL &amp; REWARDS</h2>
                <div className="warzone-career-rewards-card">
                  <div className="warzone-career-level-row">
                    <span>PRESTIGE MASTER</span>
                    <strong>LEVEL 107</strong>
                  </div>
                  <div className="warzone-career-next-level">NEXT LEVEL: 9237 XP</div>
                  <div className="warzone-career-xp-bar" aria-hidden="true">
                    <span />
                  </div>
                </div>
                <div className="warzone-career-reward-next">
                  <div className="warzone-career-reward-title">NEXT REWARD: LEVEL 125</div>
                  <div className="warzone-career-hex" aria-hidden="true" />
                  <div className="warzone-career-reward-name">FOREST</div>
                  <div className="warzone-career-reward-type">LEVEL COLOR</div>
                </div>
                <button type="button" className="warzone-career-view-rewards">
                  VIEW REWARDS
                </button>
              </aside>
            </section>

            <section className="warzone-career-section-row">
              {CAREER_SECTIONS.map((section) => (
                <button
                  key={section}
                  type="button"
                  className={`warzone-career-section ${activeCareerSection === section ? "is-active" : ""}`}
                  onClick={() => handleCareerSectionClick(section)}
                >
                  {section}
                </button>
              ))}
            </section>
          </main>
        ) : (
          <>
            <main className="warzone-store-layout">
              <section className="warzone-hero-card" style={heroStyle}>
                <div className="warzone-card-chip">{FEATURED_BUNDLES.hero.price} CP</div>
                <div className="warzone-card-copy">
                  <span className="warzone-card-label">{FEATURED_BUNDLES.hero.label}</span>
                  <h2>{FEATURED_BUNDLES.hero.title}</h2>
                </div>
                <div className="warzone-hero-actions">
                  <button type="button">{FEATURED_BUNDLES.hero.ctaPrimary}</button>
                  <button type="button">{FEATURED_BUNDLES.hero.ctaSecondary}</button>
                </div>
              </section>

              <section className="warzone-right-column">
                <article className="warzone-side-card warzone-side-card--large" style={sideTopStyle}>
                  <div className="warzone-card-chip">{FEATURED_BUNDLES.sideTop.price} CP</div>
                  <h3>{FEATURED_BUNDLES.sideTop.title}</h3>
                </article>

                <div className="warzone-side-bottom">
                  <article className="warzone-side-card" style={sideBottomLeftStyle}>
                    <div className="warzone-card-chip">{FEATURED_BUNDLES.sideBottomLeft.price} CP</div>
                    <h3>{FEATURED_BUNDLES.sideBottomLeft.title}</h3>
                  </article>
                  <article className="warzone-side-card" style={sideBottomRightStyle}>
                    <div className="warzone-card-chip">{FEATURED_BUNDLES.sideBottomRight.price}</div>
                    <h3>{FEATURED_BUNDLES.sideBottomRight.title}</h3>
                  </article>
                </div>
              </section>
            </main>

            <section className="warzone-segment-row">
              {STORE_SEGMENTS.map((segment) => (
                <button
                  key={segment}
                  type="button"
                  className={`warzone-segment ${activeSegment === segment ? "is-active" : ""}`}
                  onClick={() => handleSegmentClick(segment)}
                >
                  {segment}
                </button>
              ))}
            </section>

            <section className="warzone-trending">
              <header>
                <span>TRENDING</span>
              </header>
              <div className="warzone-trending-grid">
                {TRENDING_BUNDLES.map((bundle, index) => (
                  <article
                    key={bundle.title}
                    className="warzone-trending-card"
                    style={{
                      backgroundImage: `linear-gradient(140deg, rgba(3, 17, 29, 0.82), rgba(2, 55, 82, 0.32)), url(${storeBackground})`,
                      backgroundPosition: `${62 + index * 9}% ${74 + index * 3}%`,
                    }}
                  >
                    <span className="warzone-trending-tag">{bundle.tag}</span>
                    <h4>{bundle.title}</h4>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      <div className="warzone-statusbar">
        <span>{statusText}</span>
        <span>{isCareerTab ? "Season timer: 5d 9h" : "Store rotation: 20h 20m"}</span>
      </div>

      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default WarzoneStoreWindow;
