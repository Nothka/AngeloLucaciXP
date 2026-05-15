import React, { useCallback, useEffect, useRef, useState } from "react";
import wallpaper from "../../assets/images/backgrounds/xp-wallpaper.webp"; 
import startupSound from "../../assets/audio/xp-startup.wav";
import balloonSound from "../../assets/audio/balloon.mp3";
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
import myProjectsIcon from "../../assets/icons/apps/myprojects.webp";
import resumeIcon from "../../assets/icons/apps/Pdf.webp";
import aboutMeIcon from "../../assets/icons/apps/about.webp";
import contactIcon from "../../assets/icons/apps/contact.webp";
import instagramIcon from "../../assets/icons/apps/instagram.jpeg";
import githubIcon from "../../assets/icons/apps/github.webp";
import linkedinIcon from "../../assets/icons/apps/linkedin.webp";
import commandPromptIcon from "../../assets/icons/apps/commandprompt.webp";
import yahooIcon from "../../assets/icons/apps/recentlyused/yahoo.jpeg";
import notepadIcon from "../../assets/icons/apps/recentlyused/notepad.webp";
import wordpadIcon from "../../assets/icons/apps/wordpad.webp";
import feedbackIcon from "../../assets/icons/apps/feedback.png";
import recycleBinEmptyIcon from "../../assets/icons/apps/recycle-bin/recycle-bin-empty.webp";
import recycleBinFullIcon from "../../assets/icons/apps/recycle-bin/recycle-bin-full.webp";
import DesktopIcons from "./DesktopIcons";
import RunDialog from "./RunDialog";
import NotepadWindow from "./apps/NotepadWindow";
import WordPadWindow from "./apps/WordPadWindow";
import FeedbackWindow from "./apps/FeedbackWindow";
import RecycleBinWindow from "./apps/RecycleBinWindow";
import "../../styles/desktop/desktop-icons.css";
import { getDesktopPoint } from "./utils/desktopTransform";

const formatTimeWithPeriod = (date) =>
  date
    .toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\u202f/g, " "); 

let windowIdCounter = 0; 
const MIN_DESKTOP_WIDTH = 1280;
const MIN_DESKTOP_HEIGHT = 720;
const RUN_COMMANDS_TEXT = [
  "Windows XP Run Commands (Portfolio Edition)",
  "",
  "Apps",
  "about / about me / aboutme / winver      Open About Me",
  "resume / cv                               Open My Resume",
  "projects / portfolio / iexplore           Open My Projects",
  "contact / contact me / contactme          Open Contact Me",
  "linkedin                                  Open LinkedIn",
  "instagram                                 Open Instagram",
  "github / git                              Open Github",
  "cmd / command / command prompt            Open Command Prompt",
  "yahoo / yahoo messenger / ymail           Open Yahoo Messenger",
  "notepad                                   Open Notepad",
  "wordpad / write                           Open WordPad",
  "feedback / review / guestbook             Open Website Feedback",
  "recycle / recycle bin / bin               Open Recycle Bin",
  "help / commands                           Open this file in Notepad",
  "readme / read me                          Open desktop ReadMe file",
  "",
  "System",
  "shutdown / restart                        Trigger Shut Down flow",
  "logoff / log off                          Return to login screen",
  "",
  "Web",
  "https://... or www....                    Open URL in new tab",
  "",
  "Tip: Press Ctrl+R (or Cmd+R on Mac) to open Run.",
].join("\n");
const DESKTOP_README_TEXT = [
  "ReadMe.txt",
  "",
  "Welcome to Angelo's Windows XP Desktop Portfolio.",
  "",
  "Quick start:",
  "1. Press Ctrl+R (Cmd+R on Mac) to open Run.",
  "2. Type commands like notepad, wordpad, about, projects, or yahoo.",
  "3. Use help in Run to open the full command list.",
  "",
  "Tips:",
  "- Notepad supports save/open in your browser storage.",
  "- WordPad supports rich text formatting controls.",
  "- Feedback saves ratings and comments in Firebase Firestore.",
  "- Drag desktop icons onto Recycle Bin to move them there.",
  "- Double-click desktop icons to open apps quickly.",
].join("\n");
const RUN_APP_ALIASES = {
  about: { title: "About Me", icon: aboutMeIcon },
  "about me": { title: "About Me", icon: aboutMeIcon },
  aboutme: { title: "About Me", icon: aboutMeIcon },
  winver: { title: "About Me", icon: aboutMeIcon },
  resume: { title: "My Resume", icon: resumeIcon },
  cv: { title: "My Resume", icon: resumeIcon },
  projects: { title: "My Projects", icon: myProjectsIcon },
  portfolio: { title: "My Projects", icon: myProjectsIcon },
  iexplore: { title: "My Projects", icon: myProjectsIcon },
  contact: { title: "Contact Me", icon: contactIcon },
  "contact me": { title: "Contact Me", icon: contactIcon },
  contactme: { title: "Contact Me", icon: contactIcon },
  linkedin: { title: "LinkedIn", icon: linkedinIcon },
  instagram: { title: "Instagram", icon: instagramIcon },
  github: { title: "Github", icon: githubIcon },
  git: { title: "Github", icon: githubIcon },
  cmd: { title: "Command Prompt", icon: commandPromptIcon },
  command: { title: "Command Prompt", icon: commandPromptIcon },
  "command prompt": { title: "Command Prompt", icon: commandPromptIcon },
  commandprompt: { title: "Command Prompt", icon: commandPromptIcon },
  yahoo: { title: "Yahoo Messenger", icon: yahooIcon },
  "yahoo messenger": { title: "Yahoo Messenger", icon: yahooIcon },
  ymail: { title: "Yahoo Messenger", icon: yahooIcon },
  notepad: { title: "Notepad", icon: notepadIcon },
  wordpad: { title: "WordPad", icon: wordpadIcon },
  "word pad": { title: "WordPad", icon: wordpadIcon },
  write: { title: "WordPad", icon: wordpadIcon },
  feedback: { title: "Feedback", icon: feedbackIcon },
  review: { title: "Feedback", icon: feedbackIcon },
  reviews: { title: "Feedback", icon: feedbackIcon },
  guestbook: { title: "Feedback", icon: feedbackIcon },
  recycle: { title: "Recycle Bin", icon: recycleBinEmptyIcon },
  "recycle bin": { title: "Recycle Bin", icon: recycleBinEmptyIcon },
  bin: { title: "Recycle Bin", icon: recycleBinEmptyIcon },
};
const RUN_SPECIAL_ALIASES = {
  help: "commands",
  commands: "commands",
  readme: "readme",
  "read me": "readme",
};
const RUN_SYSTEM_ALIASES = {
  shutdown: "shutdown",
  restart: "shutdown",
  logoff: "logoff",
  "log off": "logoff",
};
const URL_COMMAND_PATTERN = /^(https?:\/\/|www\.)/i;
const DESKTOP_ICON_ORDER = [
  "about",
  "resume",
  "projects",
  "contact",
  "yahoo",
  "feedback",
  "readme",
  "recycle-bin",
];
const DESKTOP_ICON_START_X = 24;
const DESKTOP_ICON_START_Y = 24;
const DESKTOP_ICON_VERTICAL_SPACING = 92;

const createInitialDesktopItems = () =>
  [
    { id: "about", label: "About Me", icon: aboutMeIcon, appTitle: "About Me", appIcon: aboutMeIcon },
    { id: "resume", label: "My Resume", icon: resumeIcon, appTitle: "My Resume", appIcon: resumeIcon },
    { id: "projects", label: "My Projects", icon: myProjectsIcon, appTitle: "My Projects", appIcon: myProjectsIcon },
    { id: "contact", label: "Contact Me", icon: contactIcon, appTitle: "Contact Me", appIcon: contactIcon },
    { id: "yahoo", label: "Yahoo Messenger", icon: yahooIcon, appTitle: "Yahoo Messenger", appIcon: yahooIcon },
    { id: "feedback", label: "Feedback", icon: feedbackIcon, appTitle: "Feedback", appIcon: feedbackIcon },
    { id: "readme", label: "ReadMe", icon: notepadIcon, action: "open-readme" },
    {
      id: "recycle-bin",
      label: "Recycle Bin",
      icon: recycleBinEmptyIcon,
      appTitle: "Recycle Bin",
      appIcon: recycleBinEmptyIcon,
      action: "open-recycle-bin",
      isRecycleBin: true,
    },
  ].map((item, index) => ({
    ...item,
    position: {
      x: DESKTOP_ICON_START_X,
      y: DESKTOP_ICON_START_Y + index * DESKTOP_ICON_VERTICAL_SPACING,
    },
  }));

const sortDesktopItems = (items) =>
  [...items].sort((a, b) => DESKTOP_ICON_ORDER.indexOf(a.id) - DESKTOP_ICON_ORDER.indexOf(b.id));

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
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [notepadLaunchRequest, setNotepadLaunchRequest] = useState({
    id: 0,
    document: null,
    forceDiscard: false,
  });
  const [desktopItems, setDesktopItems] = useState(() => createInitialDesktopItems());
  const [recycleBinItems, setRecycleBinItems] = useState([]);
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
      const baseWidth = viewportWidth;
      const baseHeight = viewportHeight;
      const scale = 1;
      const centerOffsetX = 0;
      const centerOffsetY = 0;
      setDesktopMetrics({
        scale,
        width: baseWidth,
        height: baseHeight,
        offsetX: centerOffsetX,
        offsetY: centerOffsetY,
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
  const openRunDialog = useCallback(() => {
    setIsRunDialogOpen(true);
  }, []);
  const closeRunDialog = useCallback(() => {
    setIsRunDialogOpen(false);
  }, []);
  const openNotepadDocument = (name, content, forceDiscard = false) => {
    openApp("Notepad", notepadIcon);
    setNotepadLaunchRequest((prev) => ({
      id: prev.id + 1,
      document: {
        name,
        content,
      },
      forceDiscard,
    }));
  };
  const openCommandsInNotepad = () => {
    openNotepadDocument("Commands.txt", RUN_COMMANDS_TEXT, false);
  };
  const openReadmeInNotepad = () => {
    openNotepadDocument("ReadMe.txt", DESKTOP_README_TEXT, false);
  };

  const openRecycleBin = () => {
    openApp("Recycle Bin", recycleBinItems.length ? recycleBinFullIcon : recycleBinEmptyIcon);
  };

  const openDesktopItem = (item) => {
    if (!item) return;
    if (item.action === "open-readme") {
      openReadmeInNotepad();
      return;
    }
    if (item.action === "open-recycle-bin") {
      openRecycleBin();
      return;
    }
    if (item.appTitle) {
      openApp(item.appTitle, item.appIcon || item.icon);
      return;
    }
    openApp(item.label, item.icon);
  };

  const moveDesktopItem = (iconId, position) => {
    if (!iconId || !position) return;
    setDesktopItems((previousIcons) =>
      previousIcons.map((item) =>
        item.id === iconId
          ? {
              ...item,
              position,
            }
          : item
      )
    );
  };

  const moveDesktopIconToRecycleBin = (iconId) => {
    setDesktopItems((previousIcons) => {
      const targetIcon = previousIcons.find((item) => item.id === iconId);
      if (!targetIcon || targetIcon.isRecycleBin) return previousIcons;
      setRecycleBinItems((previousBinItems) => {
        if (previousBinItems.some((item) => item.id === targetIcon.id)) {
          return previousBinItems;
        }
        return [
          {
            ...targetIcon,
            deletedAt: Date.now(),
          },
          ...previousBinItems,
        ];
      });
      return previousIcons.filter((item) => item.id !== targetIcon.id);
    });
  };

  const restoreDesktopIconFromRecycleBin = (iconId) => {
    setRecycleBinItems((previousBinItems) => {
      const restoredIcon = previousBinItems.find((item) => item.id === iconId) || null;
      if (!restoredIcon) return previousBinItems;

      setDesktopItems((previousIcons) => {
        if (previousIcons.some((item) => item.id === restoredIcon.id)) return previousIcons;
        const cleanIcon = { ...restoredIcon };
        delete cleanIcon.deletedAt;
        return sortDesktopItems([...previousIcons, cleanIcon]);
      });

      return previousBinItems.filter((item) => item.id !== iconId);
    });
  };

  const emptyRecycleBin = () => {
    setRecycleBinItems([]);
  };

  const desktopItemsWithRecycleState = desktopItems.map((item) =>
    item.isRecycleBin
      ? {
          ...item,
          icon: recycleBinItems.length ? recycleBinFullIcon : recycleBinEmptyIcon,
          appIcon: recycleBinItems.length ? recycleBinFullIcon : recycleBinEmptyIcon,
        }
      : item
  );

  const executeRunCommand = (rawCommand) => {
    const typedValue = rawCommand.trim();
    if (!typedValue) {
      return {
        success: false,
        message: "Type the name of a program, folder, document, or Internet resource.",
      };
    }

    const normalized = typedValue.toLowerCase().replace(/\s+/g, " ");
    const normalizedNoExe = normalized.replace(/\.exe$/, "");
    const firstToken = normalizedNoExe.split(" ")[0].replace(/\.exe$/, "");
    const candidates = [normalized, normalizedNoExe, firstToken];

    for (const key of candidates) {
      const specialAction = RUN_SPECIAL_ALIASES[key];
      if (!specialAction) continue;
      if (specialAction === "commands") {
        openCommandsInNotepad();
      } else if (specialAction === "readme") {
        openReadmeInNotepad();
      }
      return { success: true };
    }

    for (const key of candidates) {
      const targetApp = RUN_APP_ALIASES[key];
      if (!targetApp) continue;
      openApp(targetApp.title, targetApp.icon);
      return { success: true };
    }

    for (const key of candidates) {
      const systemAction = RUN_SYSTEM_ALIASES[key];
      if (!systemAction) continue;
      if (systemAction === "shutdown") {
        onShutdown?.();
      } else if (systemAction === "logoff") {
        onLogOff?.();
      }
      return { success: true };
    }

    if (URL_COMMAND_PATTERN.test(typedValue)) {
      const url = /^https?:\/\//i.test(typedValue) ? typedValue : `https://${typedValue}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return { success: true };
    }

    return {
      success: false,
      message: `Windows cannot find "${typedValue}". Make sure you typed the name correctly, and then try again.`,
    };
  };


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
    const handleRunShortcut = (event) => {
      const key = event.key?.toLowerCase();
      const isRunShortcut = key === "r" && (event.metaKey || event.ctrlKey) && !event.altKey;
      if (!isRunShortcut) return;
      event.preventDefault();
      event.stopPropagation();
      setIsRunDialogOpen(true);
    };

    window.addEventListener("keydown", handleRunShortcut, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleRunShortcut, { capture: true });
    };
  }, []);

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

  useEffect(() => {
    const recycleIcon = recycleBinItems.length ? recycleBinFullIcon : recycleBinEmptyIcon;
    setWindows((previousWindows) =>
      previousWindows.map((window) =>
        window.title === "Recycle Bin" ? { ...window, icon: recycleIcon } : window
      )
    );
  }, [recycleBinItems.length]);

  const handleDesktopMouseDown = (event) => {
    if (event.button !== 0) return;
    if (isRunDialogOpen) return;
    if (event.target?.closest?.(".window")) return;
    setActiveWindowId(null);
    if (event.target?.closest?.(".taskbar")) return;
    if (event.target?.closest?.(".icon")) return;
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
          transform: "none",
          transformOrigin: "top left",
        }}
        onMouseDown={handleDesktopMouseDown}
      >
        <div className="desktop" ref={desktopRef}>
        <DesktopIcons
          items={desktopItemsWithRecycleState}
          onOpenItem={openDesktopItem}
          onMoveToRecycleBin={moveDesktopIconToRecycleBin}
          onMoveItem={moveDesktopItem}
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
          ) : window.title === "Notepad" ? (
            <NotepadWindow
              key={window.id}
              windowId={window.id}
              zIndex={window.zIndex}
              isActive={window.id === activeWindowId}
              onClose={() => closeWindow(window.id)}
              onMinimize={minimizeWindow}
              onMaximize={maximizeWindow}
              onMouseDown={bringToFront}
              launchRequest={notepadLaunchRequest}
              onOpenCommands={openCommandsInNotepad}
            />
          ) : window.title === "WordPad" ? (
            <WordPadWindow
              key={window.id}
              windowId={window.id}
              zIndex={window.zIndex}
              isActive={window.id === activeWindowId}
              onClose={() => closeWindow(window.id)}
              onMinimize={minimizeWindow}
              onMaximize={maximizeWindow}
              onMouseDown={bringToFront}
            />
          ) : window.title === "Feedback" ? (
            <FeedbackWindow
              key={window.id}
              windowId={window.id}
              zIndex={window.zIndex}
              isActive={window.id === activeWindowId}
              onClose={() => closeWindow(window.id)}
              onMinimize={minimizeWindow}
              onMaximize={maximizeWindow}
              onMouseDown={bringToFront}
            />
          ) : window.title === "Recycle Bin" ? (
            <RecycleBinWindow
              key={window.id}
              windowId={window.id}
              zIndex={window.zIndex}
              isActive={window.id === activeWindowId}
              onClose={() => closeWindow(window.id)}
              onMinimize={minimizeWindow}
              onMaximize={maximizeWindow}
              onMouseDown={bringToFront}
              items={recycleBinItems}
              onRestoreItem={restoreDesktopIconFromRecycleBin}
              onEmptyBin={emptyRecycleBin}
            />
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
        <RunDialog
          isOpen={isRunDialogOpen}
          onClose={closeRunDialog}
          onRun={executeRunCommand}
        />

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
            onOpenRunDialog={openRunDialog}
          />
        </div>
      </div>
    </div>
  );
};

export default Desktop;
