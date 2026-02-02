import React, { useCallback, useEffect, useRef, useState } from "react";
import wallpaper from "../../assets/xp-wallpaper.webp"; // pune imaginea ta XP
import startupSound from "../../assets/xp-startup.wav";
import balloonSound from "../../assets/balloon.mp3";
import Taskbar from "../desktop/taskbar/Taskbar";
import WelcomeToast from "./WelcomeToast";
import MyProjectWindow from "./apps/MyProjectWindow";
import CommandPromptWindow from "./CommandPromptWindow";
import LinkedInWindow from "./apps/linkedin";
import InstagramWindow from "./apps/instagram";
import GitHubWindow from "./apps/github";
import MyResumeWindow from "./apps/MyResumeWindow";
import ContactMeWindow from "./apps/contactme";
import AboutMeWindow from "./apps/aboutme";
import YahooWindow from "./apps/yahoo/yahoo";
import myProjectsIcon from "../../assets/startmenu/myprojects.webp";
import resumeIcon from "../../assets/startmenu/Pdf.png";
import aboutMeIcon from "../../assets/startmenu/about.webp";
import DesktopIcons from "./DesktopIcons";
import "../../styles/desktop/desktop-icons.css";
import { getDesktopPoint } from "./utils/desktopTransform";

const formatTimeWithPeriod = (date) =>
  date
    .toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\u202f/g, " "); // Normalize any narrow spaces some locales add

let windowIdCounter = 0; // To ensure unique IDs
const MIN_DESKTOP_WIDTH = 1280;
const MIN_DESKTOP_HEIGHT = 720;

const Desktop = ({ onLogOff, onShutdown }) => {
  const [time, setTime] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const [shouldPlayBalloon, setShouldPlayBalloon] = useState(false);
  const balloonAudioRef = useRef(null);
  const [windows, setWindows] = useState([]);
  const [activeWindowId, setActiveWindowId] = useState(null);
  const [nextZIndex, setNextZIndex] = useState(100);
  const [yahooConversationEntries, setYahooConversationEntries] = useState([]);
  const yahooConversationApiRef = useRef(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const desktopRef = useRef(null);
  const [desktopMetrics, setDesktopMetrics] = useState({
    scale: 1,
    width: MIN_DESKTOP_WIDTH,
    height: MIN_DESKTOP_HEIGHT,
    offsetX: 0,
    offsetY: 0,
  });

  useEffect(() => {
    const updateMetrics = () => {
      if (typeof window === "undefined") return;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const isMobile = viewportWidth <= 768;
      const baseWidth = isMobile ? viewportWidth : Math.max(MIN_DESKTOP_WIDTH, viewportWidth);
      const baseHeight = isMobile ? viewportHeight : Math.max(MIN_DESKTOP_HEIGHT, viewportHeight);
      const scale = isMobile
        ? 1
        : Math.min(1, viewportWidth / baseWidth, viewportHeight / baseHeight);
      const scaledWidth = baseWidth * scale;
      const scaledHeight = baseHeight * scale;
      const centerOffsetX = Math.max(0, (viewportWidth - scaledWidth) / 2);
      const centerOffsetY = Math.max(0, (viewportHeight - scaledHeight) / 2);
      setDesktopMetrics({
        scale,
        width: baseWidth,
        height: baseHeight,
        offsetX: isMobile ? 0 : centerOffsetX,
        offsetY: isMobile ? 0 : centerOffsetY,
      });
    };
    updateMetrics();
    window.addEventListener("resize", updateMetrics);
    return () => window.removeEventListener("resize", updateMetrics);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__desktopTransform = {
      scale: desktopMetrics.scale,
      offsetX: desktopMetrics.offsetX,
      offsetY: desktopMetrics.offsetY,
    };
  }, [desktopMetrics]);

  const getTopmostWindowId = (windowList) => {
    const topmost = windowList.reduce((current, window) => {
      if (window.minimized) return current;
      if (!current || window.zIndex > current.zIndex) return window;
      return current;
    }, null);
    return topmost ? topmost.id : null;
  };

  const openWindow = (label, icon) => {
    const newWindowId = `window-${windowIdCounter++}`;
    const newWindow = {
      id: newWindowId, // Unique ID
      title: label,
      icon: icon, // You can add an icon property here if needed
      content: <div>{label} Content</div>, // Placeholder content
      zIndex: nextZIndex,
      minimized: false,
      maximized: false,
    };
    setWindows((prevWindows) => [...prevWindows, newWindow]);
    setNextZIndex(nextZIndex + 1);
    setActiveWindowId(newWindowId);
  };

  const closeWindow = (id) => {
    setWindows((prevWindows) => {
      const nextWindows = prevWindows.filter((window) => window.id !== id);
      if (activeWindowId === id) {
        setActiveWindowId(getTopmostWindowId(nextWindows));
      }
      return nextWindows;
    });
  };

  const minimizeWindow = (id) => {
    setWindows((prevWindows) => {
      const nextWindows = prevWindows.map((window) =>
        window.id === id ? { ...window, minimized: !window.minimized } : window
      );
      const targetWindow = nextWindows.find((window) => window.id === id);
      if (targetWindow?.minimized) {
        if (activeWindowId === id) {
          setActiveWindowId(getTopmostWindowId(nextWindows));
        }
      } else {
        setActiveWindowId(id);
      }
      return nextWindows;
    });
  };

  const maximizeWindow = (id) => {
    setWindows((prevWindows) =>
      prevWindows.map((window) =>
        window.id === id ? { ...window, maximized: !window.maximized, minimized: false } : window
      )
    );
  };

  const bringToFront = (id) => {
    setWindows((prevWindows) =>
      prevWindows.map((window) =>
        window.id === id ? { ...window, zIndex: nextZIndex, minimized: false } : window
      )
    );
    setNextZIndex(nextZIndex + 1);
    setActiveWindowId(id);
  };

  const openApp = (label, icon) => {
    const existingWindow = windows.find((win) => win.title === label);
    if (existingWindow) {
      bringToFront(existingWindow.id);
    } else {
      openWindow(label, icon);
    }
  };

  const handleConversationTaskbarClick = (conversationId) => {
    const conversation = yahooConversationEntries.find((entry) => entry.id === conversationId);
    if (!conversation) return;
    const api = yahooConversationApiRef.current;
    if (!api) return;
    if (conversation.minimized) {
      api.restoreConversation?.(conversationId);
      return;
    }
    if (conversation.isActive) {
      api.minimizeConversation?.(conversationId);
      return;
    }
    api.focusConversation?.(conversationId);
  };

  const handleYahooConversationApiReady = useCallback((api) => {
    yahooConversationApiRef.current = api;
  }, []);


  useEffect(() => {
    const updateTime = () => {
      setTime(formatTimeWithPeriod(new Date()));
    };
    updateTime();
    const id = setInterval(updateTime, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const audio = new Audio(startupSound);
    audio.volume = 0.8;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(true);
      setShouldPlayBalloon(true);
    }, 5500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const audio = new Audio(balloonSound);
    audio.volume = 0.9;
    balloonAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  useEffect(() => {
    if (showWelcome && shouldPlayBalloon && balloonAudioRef.current) {
      balloonAudioRef.current.currentTime = 0;
      balloonAudioRef.current.play().catch(() => {});
      setShouldPlayBalloon(false);
    }
  }, [showWelcome, shouldPlayBalloon]);

  useEffect(() => {
    if (!isSelecting) return;

    const handleMouseMove = (event) => {
      const { x, y } = getDesktopPoint(event);
      const clampedX = Math.min(Math.max(0, x), desktopMetrics.width);
      const clampedY = Math.min(Math.max(0, y), desktopMetrics.height);
      setSelectionEnd({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isSelecting]);

  const handleDesktopMouseDown = (event) => {
    if (event.button !== 0) return;
    if (event.target?.closest?.(".window")) return;
    setActiveWindowId(null);
    if (event.target?.closest?.(".taskbar")) return;
    if (event.target?.closest?.(".desktop-icons")) return;
    const { x, y } = getDesktopPoint(event);
    const clampedX = Math.min(Math.max(0, x), desktopMetrics.width);
    const clampedY = Math.min(Math.max(0, y), desktopMetrics.height);
    setSelectionStart({ x: clampedX, y: clampedY });
    setSelectionEnd({ x: clampedX, y: clampedY });
    setIsSelecting(true);
    event.preventDefault();
  };

  const selectionRectClient =
    selectionStart && selectionEnd
      ? {
          left:
            Math.min(selectionStart.x, selectionEnd.x) * desktopMetrics.scale +
            desktopMetrics.offsetX,
          top:
            Math.min(selectionStart.y, selectionEnd.y) * desktopMetrics.scale +
            desktopMetrics.offsetY,
          right:
            Math.max(selectionStart.x, selectionEnd.x) * desktopMetrics.scale +
            desktopMetrics.offsetX,
          bottom:
            Math.max(selectionStart.y, selectionEnd.y) * desktopMetrics.scale +
            desktopMetrics.offsetY,
          width:
            Math.abs(selectionEnd.x - selectionStart.x) * desktopMetrics.scale,
          height:
            Math.abs(selectionEnd.y - selectionStart.y) * desktopMetrics.scale,
        }
      : null;
  const desktopRect = selectionRectClient ? desktopRef.current?.getBoundingClientRect() : null;
  const selectionRect =
    selectionRectClient && desktopRect
      ? {
          left: Math.min(selectionStart.x, selectionEnd.x),
          top: Math.min(selectionStart.y, selectionEnd.y),
          width: Math.abs(selectionEnd.x - selectionStart.x),
          height: Math.abs(selectionEnd.y - selectionStart.y),
        }
      : null;

  return (
    <div
      className="desktop-viewport"
      style={{ backgroundImage: `url(${wallpaper})` }}
    >
      <div
        className="desktop-body"
        style={{
          backgroundImage: `url(${wallpaper})`,
          width: desktopMetrics.width,
          height: desktopMetrics.height,
          transform: `translate(${desktopMetrics.offsetX}px, ${desktopMetrics.offsetY}px) scale(${desktopMetrics.scale})`,
          transformOrigin: "top left",
        }}
        onMouseDown={handleDesktopMouseDown}
      >
        <div className="desktop" ref={desktopRef}>
        <DesktopIcons
          openApp={openApp}
          selectionRect={selectionRectClient}
          isSelecting={isSelecting}
        />
        {selectionRect && (selectionRect.width > 2 || selectionRect.height > 2) ? (
          <div
            className="desktop-selection-rect"
            style={{
              left: selectionRect.left,
              top: selectionRect.top,
              width: selectionRect.width,
              height: selectionRect.height,
            }}
          />
        ) : null}

        {windows.map((window) => {
          const isYahoo = window.title === "Yahoo Messenger" || window.title === "Yahoo";
          if (window.minimized && !isYahoo) {
            return null;
          }
          return window.title === "My Projects" ? (
            <MyProjectWindow
              key={window.id}
              windowId={window.id}
              title={window.title}
              zIndex={window.zIndex}
              isActive={window.id === activeWindowId}
              onClose={() => closeWindow(window.id)}
              onMinimize={minimizeWindow}
              onMaximize={maximizeWindow}
              onMouseDown={bringToFront}
            >
              {window.content}
            </MyProjectWindow>
          ) : window.title === "Command Prompt" ? (
            <CommandPromptWindow
              key={window.id}
              windowId={window.id}
              title={window.title}
              zIndex={window.zIndex}
              isActive={window.id === activeWindowId}
              onClose={() => closeWindow(window.id)}
              onMinimize={minimizeWindow}
              onMaximize={maximizeWindow}
              onMouseDown={bringToFront}
            >
              {window.content}
            </CommandPromptWindow>
          ) : window.title === "LinkedIn" ? (
            <LinkedInWindow
              key={window.id}
              windowId={window.id}
              zIndex={window.zIndex}
              isActive={window.id === activeWindowId}
              onClose={() => closeWindow(window.id)}
              onMouseDown={bringToFront}
            />
          ) : window.title === "Instagram" ? (
            <InstagramWindow
              key={window.id}
              windowId={window.id}
              zIndex={window.zIndex}
              isActive={window.id === activeWindowId}
              onClose={() => closeWindow(window.id)}
              onMouseDown={bringToFront}
            />
          ) : window.title === "Github" ? (
            <GitHubWindow
              key={window.id}
              windowId={window.id}
              zIndex={window.zIndex}
              isActive={window.id === activeWindowId}
              onClose={() => closeWindow(window.id)}
              onMouseDown={bringToFront}
            />
          ) : isYahoo ? (
            <YahooWindow
              key={window.id}
              windowId={window.id}
              zIndex={window.zIndex}
              isActive={window.id === activeWindowId}
              isMinimized={window.minimized}
              onClose={() => closeWindow(window.id)}
              onMinimize={minimizeWindow}
              onMaximize={maximizeWindow}
              onMouseDown={bringToFront}
              onConversationListChange={setYahooConversationEntries}
              onConversationApiReady={handleYahooConversationApiReady}
            />
          ) : window.title === "My Resume" ? (
            <MyResumeWindow
              key={window.id}
              windowId={window.id}
              title={window.title}
              zIndex={window.zIndex}
              isActive={window.id === activeWindowId}
              onClose={() => closeWindow(window.id)}
              onMinimize={minimizeWindow}
              onMaximize={maximizeWindow}
              onMouseDown={bringToFront}
              onOpenContact={() => openApp("Contact Me", window.icon)}
            />
          ) : window.title === "About Me" ? (
            <AboutMeWindow
              key={window.id}
              windowId={window.id}
              title={window.title}
              zIndex={window.zIndex}
              isActive={window.id === activeWindowId}
              onClose={() => closeWindow(window.id)}
              onMinimize={minimizeWindow}
              onMaximize={maximizeWindow}
              onMouseDown={bringToFront}
              onOpenLinkedIn={() => openApp("LinkedIn", window.icon)}
              onOpenGithub={() => openApp("Github", window.icon)}
              onOpenInstagram={() => openApp("Instagram", window.icon)}
              onOpenResume={() => openApp("My Resume", resumeIcon)}
              onOpenProjects={() => openApp("My Projects", myProjectsIcon)}
            />
          ) : window.title === "Contact Me" ? (
            <ContactMeWindow
              key={window.id}
              windowId={window.id}
              title={window.title}
              zIndex={window.zIndex}
              isActive={window.id === activeWindowId}
              onClose={() => closeWindow(window.id)}
              onMinimize={minimizeWindow}
              onMaximize={maximizeWindow}
              onMouseDown={bringToFront}
              onOpenLinkedIn={() => openApp("LinkedIn", window.icon)}
            />
          ) : (
            <div
              key={window.id}
              style={{
                position: "absolute",
                top: "100px",
                left: "100px",
                zIndex: window.zIndex,
                background: "white",
                padding: "20px",
                border: "1px solid gray",
                color: "black",
              }}
              onMouseDown={() => bringToFront(window.id)}
            >
              <h3>{window.title}</h3>
              {window.content}
              <button onClick={() => closeWindow(window.id)}>Close</button>
            </div>
          );
        })}

        {showWelcome ? (
          <WelcomeToast
            onClose={() => setShowWelcome(false)}
            onOpenAbout={() => openApp("About Me", aboutMeIcon)}
            onOpenProjects={() => openApp("My Projects", myProjectsIcon)}
          />
        ) : null}

          <Taskbar
            time={time}
            onToggleWelcome={() => setShowWelcome((prev) => !prev)}
            windows={windows}
            onMinimize={minimizeWindow}
            onMaximize={maximizeWindow}
            onBringToFront={bringToFront}
            openApp={openApp}
            extraApps={yahooConversationEntries}
            onExtraAppClick={handleConversationTaskbarClick}
            onLogOff={onLogOff}
            onShutdown={onShutdown}
          />
        </div>
      </div>
    </div>
  );
};

export default Desktop;
