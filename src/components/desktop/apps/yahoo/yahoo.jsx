import React, { useCallback, useEffect, useRef, useState } from "react";
import yahooIcon from "../../../../assets/yahoo/header/yahoomessenger-cropped.png";
import typingIcon from "../../../../assets/yahoo/yahoo-window/typing.png";
import yahooLoginImage from "../../../../assets/yahoo/yahoo-login.gif";
import yahooAfterLoginImage from "../../../../assets/yahoo/yahoo-afterlogin.gif";
import messageSound from "../../../../assets/yahoo/audibles/message.mp3";
import buzzSound from "../../../../assets/yahoo/audibles/buzz.mp3";
import minimizeIcon from "../../../../assets/yahoo/header/window-minimize.png";
import maximizeIcon from "../../../../assets/yahoo/header/maximise.png";
import closeIcon from "../../../../assets/yahoo/header/close.png";
import YahooSignedIn, { DEFAULT_FRIEND_CONTACTS } from "./yahoosignedin";
import YahooAddFriendsWindow from "./addfriends";
import YahooConversationWindow from "./yahoo-conversation-window/yahoo-window";
import { EMOTICON_CODES } from "./emoticonData";
import ResizeHandles from "../../ResizeHandles";
import useWindowResize from "../../hooks/useWindowResize";
import "../../../../styles/desktop/window.css";
import "../../../../styles/desktop/apps/yahoo/yahoo.css";
import snowmanIcon from "../../../../assets/yahoo/snowman.png";
import { getDesktopPoint } from "../../utils/desktopTransform";

const WINDOW_SIZE = { width: 320, height: 520 };
const SIGN_IN_LOGIN_DELAY = 80;
const SIGN_IN_AFTERLOGIN_DELAY = 2750;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const EMOTICON_PATTERN = EMOTICON_CODES.map(escapeRegex)
  .sort((a, b) => b.length - a.length)
  .join("|");
const EMOTICON_ONLY_REGEX = new RegExp(`^(?:\\s*(?:${EMOTICON_PATTERN})\\s*)+$`);
const formatConversationTaskbarTitle = (name = "") => {
  const trimmed = name.trim();
  if (!trimmed) return "Conversation";
  if (trimmed.toLowerCase() === "chatgpt") return "Chatgpt";
  return trimmed;
};
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "https://monumental-croissant-e8ec10.netlify.app";
const CHAT_API_URL = `${API_BASE.replace(/\/$/, "")}/api/chat`;

const MENU_DATA = {
  Messenger: [
    { label: "My Availability", submenu: true },
    { label: "No Incoming Calls" },
    { type: "separator" },
    { label: "Yahoo! Insider" },
    { label: "My Contact Details" },
    { label: "My Account Info" },
    { label: "My Display Image", shortcut: "Ctrl+Shift+F8" },
    { label: "My Webcam" },
    { type: "separator" },
    { label: "Show/Hide", submenu: true },
    { type: "separator" },
    { label: "Preferences", shortcut: "Ctrl+Shift+P" },
    { label: "Privacy Options" },
    { label: "Manage Updates I Broadcast..." },
    { type: "separator" },
    { label: "Sign In to Mobile Phone...", shortcut: "Ctrl+Shift+D" },
    { label: "Sign Out", shortcut: "Ctrl+D" },
    { type: "separator" },
    { label: "Close", shortcut: "Ctrl+Q" },
  ],
  Contacts: [
    { label: "Add a Contact", shortcut: "Ctrl+Shift+A" },
    { label: "Add an Address Book Contact" },
    { label: "Import Contacts..." },
    { type: "separator" },
    { label: "Manage Groups", submenu: true },
    { label: "Delete...", disabled: true },
    { type: "separator" },
    { label: "Stealth Settings", submenu: true },
    { label: "Contact Details" },
    { label: "Conversation History", shortcut: "Alt+Shift+V" },
    { label: "View Profile", disabled: true },
    { label: "Ringtone", submenu: true },
    { type: "separator" },
    { label: "Compact List", shortcut: "Ctrl+Alt+C" },
    { label: "Detailed List", shortcut: "Ctrl+Alt+D", selected: true },
    { type: "separator" },
    { label: "Show/Hide", submenu: true },
  ],
  Actions: [
    { label: "Send Instant Message...", shortcut: "Ctrl+M" },
    { label: "Start Video Call...", shortcut: "Ctrl+J" },
    { label: "Start Voice Call...", shortcut: "Ctrl+L" },
    { label: "Send SMS Message...", shortcut: "Ctrl+T" },
    { label: "Send Email...", shortcut: "Ctrl+Y", disabled: true },
    { type: "separator" },
    { label: "Send My Contact Details...", shortcut: "Ctrl+Shift+C" },
    { label: "Send My Messenger List...", shortcut: "Ctrl+Shift+M" },
    { label: "Request Contact Details", shortcut: "Ctrl+Shift+R" },
    { type: "separator" },
    { label: "Send File..." },
    { label: "Share Photos..." },
    { label: "Choose Plug-in..." },
    { label: "Invite to Conference..." },
    { type: "separator" },
    { label: "More Actions", submenu: true },
  ],
};

const getDefaultPosition = () => {
  if (typeof window === "undefined") return { x: 240, y: 140 };
  return {
    x: Math.max(40, Math.round((window.innerWidth - WINDOW_SIZE.width) / 2)),
    y: Math.max(40, Math.round((window.innerHeight - WINDOW_SIZE.height - 30) / 2)),
  };
};

const YahooWindow = ({
  windowId,
  onClose,
  onMinimize,
  onMaximize,
  onConversationListChange,
  onConversationApiReady,
  zIndex,
  onMouseDown,
  isMinimized = false,
  isActive = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState(getDefaultPosition);
  const [size, setSize] = useState(WINDOW_SIZE);
  const [username, setUsername] = useState("angelo_lucaci");
  const [password, setPassword] = useState("lucaci");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [signedInUser, setSignedInUser] = useState("");
  const [showAfterLogin, setShowAfterLogin] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [menuLeft, setMenuLeft] = useState(0);
  const [conversations, setConversations] = useState([]);
  const [friendContacts, setFriendContacts] = useState(() =>
    DEFAULT_FRIEND_CONTACTS.map((contact) => ({ ...contact }))
  );
  const conversationsRef = useRef([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isConversationWindowMinimized, setIsConversationWindowMinimized] = useState(false);
  const [isAddFriendsOpen, setIsAddFriendsOpen] = useState(false);
  const [subWindowOrder, setSubWindowOrder] = useState([
    "main",
    "conversation",
    "addfriends",
  ]);
  const windowRef = useRef(null);
  const signInTimeoutRef = useRef(null);
  const signInPhaseTimeoutRef = useRef(null);
  const headerMenuRef = useRef(null);
  const menuRef = useRef(null);
  const conversationIdRef = useRef(0);
  const friendIdRef = useRef(DEFAULT_FRIEND_CONTACTS.length);
  const conversationMessageIdRef = useRef(0);
  const messageAudioRef = useRef(null);
  const buzzAudioRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const originalPosition = useRef(getDefaultPosition());
  const originalSize = useRef(WINDOW_SIZE);
  const { startResize } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 280,
    minHeight: 460,
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

  const bringSubWindowToFront = useCallback(
    (key) => {
      setSubWindowOrder((prev) => {
        const next = prev.filter((item) => item !== key);
        next.push(key);
        return next;
      });
      onMouseDown?.(windowId);
    },
    [onMouseDown, windowId]
  );

  const openSubWindows = [
    "main",
    activeConversationId && !isConversationWindowMinimized ? "conversation" : null,
    isAddFriendsOpen ? "addfriends" : null,
  ].filter(Boolean);
  const topSubWindow =
    [...subWindowOrder].reverse().find((key) => openSubWindows.includes(key)) || "main";
  const getSubWindowZIndex = (key) => {
    const orderIndex = subWindowOrder.indexOf(key);
    return zIndex + Math.max(orderIndex, 0);
  };

  const handleMouseDown = (event) => {
    if (isMaximized || event.button !== 0) return;
    setIsDragging(true);
    const point = getDesktopPoint(event);
    dragOffset.current = {
      x: point.x - position.x,
      y: point.y - position.y,
    };
    bringSubWindowToFront("main");
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

  const handleSignIn = () => {
    const normalizedUsername = username.trim();
    if (normalizedUsername === "angelo_lucaci" && password === "lucaci") {
      setSignedInUser(normalizedUsername);
      setShowAfterLogin(false);
      setIsSigningIn(true);
    }
  };

  const handleCancelSignIn = () => {
    setSignedInUser("");
    setIsSignedIn(false);
    setIsSigningIn(false);
    setShowAfterLogin(false);
    if (signInTimeoutRef.current) {
      clearTimeout(signInTimeoutRef.current);
      signInTimeoutRef.current = null;
    }
    if (signInPhaseTimeoutRef.current) {
      clearTimeout(signInPhaseTimeoutRef.current);
      signInPhaseTimeoutRef.current = null;
    }
  };

  const openAddFriends = useCallback(() => {
    setIsAddFriendsOpen(true);
    bringSubWindowToFront("addfriends");
  }, [bringSubWindowToFront]);

  const closeAddFriends = useCallback(() => {
    setIsAddFriendsOpen(false);
  }, []);

  const handleAddFriend = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setFriendContacts((prev) => {
      const exists = prev.some(
        (contact) => contact.name.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (exists) return prev;
      return [
        ...prev,
        {
          id: `yahoo-friend-${friendIdRef.current++}`,
          name: trimmed,
          icon: snowmanIcon,
          isFriend: true,
        },
      ];
    });
  }, []);

  const handleSignOut = () => {
    setSignedInUser("");
    setIsSignedIn(false);
    setIsSigningIn(false);
    setShowAfterLogin(false);
    setPassword("");
    setConversations([]);
    setActiveConversationId(null);
    setIsConversationWindowMinimized(false);
    setIsAddFriendsOpen(false);
    setActiveMenu(null);
    onConversationListChange?.([]);
    onConversationApiReady?.(null);
  };

  useEffect(() => {
    if (isSigningIn) {
      signInPhaseTimeoutRef.current = setTimeout(() => {
        setShowAfterLogin(true);
      }, SIGN_IN_LOGIN_DELAY);
      signInTimeoutRef.current = setTimeout(() => {
        setIsSigningIn(false);
        setIsSignedIn(true);
        setShowAfterLogin(false);
      }, SIGN_IN_LOGIN_DELAY + SIGN_IN_AFTERLOGIN_DELAY);
    }

    return () => {
      if (signInTimeoutRef.current) {
        clearTimeout(signInTimeoutRef.current);
        signInTimeoutRef.current = null;
      }
      if (signInPhaseTimeoutRef.current) {
        clearTimeout(signInPhaseTimeoutRef.current);
        signInPhaseTimeoutRef.current = null;
      }
    };
  }, [isSigningIn]);

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

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (!activeMenu) return;
    const handleOutsideClick = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      if (headerMenuRef.current?.contains(event.target)) return;
      setActiveMenu(null);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [activeMenu]);

  useEffect(() => {
    if (!isSignedIn && activeMenu) {
      setActiveMenu(null);
    }
  }, [isSignedIn, activeMenu]);

  const headerMenuItems = isSignedIn
    ? ["Messenger", "Contacts", "Actions", "Help"]
    : ["Messenger", "Help"];

  const handleHeaderMenuClick = (label, event) => {
    if (!MENU_DATA[label]) {
      setActiveMenu(null);
      return;
    }
    setActiveMenu((prev) => (prev === label ? null : label));
    setMenuLeft(event.currentTarget.offsetLeft);
  };

  const openConversation = useCallback(
    (contact) => {
      if (!contact?.name) return;
      let nextId = null;
      setConversations((prev) => {
        const existing = prev.find((item) => item.contactName === contact.name);
        if (existing) {
          nextId = existing.id;
          return prev;
        }
        nextId = `yahoo-conversation-${conversationIdRef.current++}`;
        return [
          ...prev,
          {
            id: nextId,
            contactName: contact.name,
            title: contact.name,
            icon: contact.icon,
            messages: [],
            draft: "",
          },
        ];
      });
      if (nextId) {
        setActiveConversationId(nextId);
      }
      setIsConversationWindowMinimized(false);
      bringSubWindowToFront("conversation");
    },
    [bringSubWindowToFront]
  );

  const focusConversation = useCallback(
    (id) => {
      setActiveConversationId(id);
      setIsConversationWindowMinimized(false);
      bringSubWindowToFront("conversation");
    },
    [bringSubWindowToFront]
  );

  const minimizeConversation = useCallback(() => {
    setIsConversationWindowMinimized(true);
  }, []);

  const restoreConversation = useCallback(
    (id) => {
      setActiveConversationId(id);
      setIsConversationWindowMinimized(false);
      bringSubWindowToFront("conversation");
    },
    [bringSubWindowToFront]
  );

  const closeConversationWindow = useCallback(() => {
    setConversations([]);
    setActiveConversationId(null);
    setIsConversationWindowMinimized(false);
  }, []);

  const handleConversationTabSelect = useCallback(
    (id) => {
      setActiveConversationId(id);
      setIsConversationWindowMinimized(false);
      bringSubWindowToFront("conversation");
    },
    [bringSubWindowToFront]
  );

  const playMessageSound = useCallback(() => {
    if (typeof Audio === "undefined") return;
    if (!messageAudioRef.current) {
      messageAudioRef.current = new Audio(messageSound);
    }
    messageAudioRef.current.currentTime = 0;
    messageAudioRef.current.play().catch(() => {});
  }, []);

  const playBuzzSound = useCallback(() => {
    if (typeof Audio === "undefined") return;
    if (!buzzAudioRef.current) {
      buzzAudioRef.current = new Audio(buzzSound);
    }
    buzzAudioRef.current.currentTime = 0;
    buzzAudioRef.current.play().catch(() => {});
  }, []);

  const updateConversationDraft = useCallback((id, nextDraft) => {
    setConversations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, draft: nextDraft } : item))
    );
  }, []);

  const sendMessage = useCallback(
    async (id, text, { isBuzz = false, clearDraft = false } = {}) => {
      const trimmed = (text || "").trim();
      if (!trimmed) return;
      const isEmoteOnly = EMOTICON_ONLY_REGEX.test(trimmed);

      let payload = null;
      const displayName = signedInUser || username.trim() || "angelo_lucaci";
      const buildNextConversations = (list) =>
        list.map((item) => {
          if (item.id !== id) return item;
          const nextMessages = [
            ...(item.messages || []),
            {
              id: `msg-${conversationMessageIdRef.current++}`,
              sender: "user",
              text: trimmed,
              ...(isBuzz ? { isBuzz: true } : {}),
            },
          ];
          if (!payload) {
            payload = {
              contactName: item.contactName,
              username: displayName,
              messages: nextMessages,
            };
          }
          return {
            ...item,
            draft: clearDraft ? "" : item.draft,
            messages: nextMessages,
          };
        });

      buildNextConversations(conversationsRef.current || []);
      if (!payload) return;
      setConversations((prev) => buildNextConversations(prev));

      const history = payload.messages
        .slice(-12)
        .map((message) => {
          const role = message.sender === "user" ? "user" : "assistant";
          const rawText = String(message.text || "");
          const trimmedText = rawText.trim();
          if (role === "user") {
            const isBuzzMessage =
              message.isBuzz ||
              trimmedText.toUpperCase() === "BUZZ!!" ||
              trimmedText.toUpperCase() === "BUZZ";
            if (isBuzzMessage) {
              return {
                role,
                content: `${trimmedText || "BUZZ!!"}\n(User sent a buzz. Reply briefly.)`,
              };
            }
            if (EMOTICON_ONLY_REGEX.test(trimmedText)) {
              return {
                role,
                content: `${trimmedText}\n(User sent the emoticon above. Reply briefly.)`,
              };
            }
          }
          return { role, content: rawText };
        })
        .filter((message) => message.content);

      try {
        const response = await fetch(CHAT_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            username: payload.username,
            contactName: payload.contactName,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Chat response failed.");
        }

        const rawReply = String(data?.reply || "").trim();
        const replyText = isBuzz ? "BUZZ!!" : rawReply || (isEmoteOnly ? "🙂" : "");
        if (!replyText) return;

        setConversations((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  messages: [
                    ...(item.messages || []),
                    {
                      id: `msg-${conversationMessageIdRef.current++}`,
                      sender: "contact",
                      text: replyText,
                    },
                  ],
                }
              : item
          )
        );
        playMessageSound();
      } catch (error) {
        const fallbackText =
          error instanceof Error ? error.message : "Unable to reach ChatGPT right now.";
        const replyText = isBuzz ? "BUZZ!!" : fallbackText;
        setConversations((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  messages: [
                    ...(item.messages || []),
                    {
                      id: `msg-${conversationMessageIdRef.current++}`,
                      sender: "contact",
                      text: replyText,
                    },
                  ],
                }
              : item
          )
        );
        playMessageSound();
      }
    },
    [playMessageSound, signedInUser, username]
  );

  const sendConversationMessage = useCallback(
    (id, draftText) => sendMessage(id, draftText, { clearDraft: true }),
    [sendMessage]
  );

  const sendBuzzMessage = useCallback(
    (id) => {
      playBuzzSound();
      sendMessage(id, "BUZZ!!", { isBuzz: true });
    },
    [playBuzzSound, sendMessage]
  );

  useEffect(() => {
    if (!onConversationListChange) return;
    const entries = conversations.map((conversation) => ({
      id: conversation.id,
      title: formatConversationTaskbarTitle(conversation.contactName),
      icon: typingIcon,
      minimized: isConversationWindowMinimized,
      isActive: conversation.id === activeConversationId && !isConversationWindowMinimized,
    }));
    onConversationListChange(entries);
  }, [conversations, activeConversationId, isConversationWindowMinimized, onConversationListChange]);

  useEffect(() => {
    if (!onConversationApiReady) return;
    onConversationApiReady({
      focusConversation,
      minimizeConversation,
      restoreConversation,
    });
  }, [focusConversation, minimizeConversation, onConversationApiReady, restoreConversation]);

  useEffect(() => {
    return () => {
      onConversationListChange?.([]);
      onConversationApiReady?.(null);
    };
  }, [onConversationListChange, onConversationApiReady]);

  useEffect(() => {
    if (activeConversationId || !conversations.length) return;
    setActiveConversationId(conversations[0].id);
  }, [activeConversationId, conversations]);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0];

  const conversationTitleText = Array.from(
    new Set(conversations.map((conversation) => conversation.contactName).filter(Boolean))
  ).join(", ");
  const isMainActive = isActive && topSubWindow === "main";
  const isConversationActive =
    isActive && topSubWindow === "conversation" && !isConversationWindowMinimized;
  const isAddFriendsActive = isActive && topSubWindow === "addfriends";

  return (
    <>
      <div
        className={`window yahoo-window ${isMainActive ? "" : "is-inactive"} ${
          isMaximized ? "maximized" : ""
        }`}
        ref={windowRef}
        style={{
          top: position.y,
          left: position.x,
          zIndex: getSubWindowZIndex("main"),
          width: size.width,
          height: size.height,
          display: isMinimized ? "none" : undefined,
        }}
        onMouseDown={() => bringSubWindowToFront("main")}
      >
        <div className="window-header" onMouseDown={handleMouseDown} onDoubleClick={toggleMaximize}>
          <div className="yahoo-header-top">
            <div className="window-title">
              <img
                src={yahooIcon}
                alt="Yahoo Messenger"
                className="window-title-icon yahoo-title-icon"
                draggable="false"
              />
            </div>
            <div className="window-buttons">
              {onMinimize ? (
                <button className="window-btn minimize" onClick={() => onMinimize(windowId)}>
                  <img src={minimizeIcon} alt="Minimize" />
                </button>
              ) : null}
              <button className="window-btn maximize" onClick={toggleMaximize}>
                <img src={maximizeIcon} alt="Maximize" />
              </button>
              <button className="window-btn close" onClick={() => onClose(windowId)}>
                <img src={closeIcon} alt="Close" />
              </button>
            </div>
          </div>
          <div
            className="yahoo-header-menu"
            onMouseDown={(event) => event.stopPropagation()}
            ref={headerMenuRef}
          >
            {headerMenuItems.map((item) => (
              <button
                key={item}
                type="button"
                className={activeMenu === item ? "is-active" : ""}
                onClick={(event) => handleHeaderMenuClick(item, event)}
              >
                {item}
              </button>
            ))}
            {activeMenu && MENU_DATA[activeMenu] ? (
              <div
                className="yahoo-header-dropdown"
                style={{ left: menuLeft }}
                ref={menuRef}
                onMouseDown={(event) => event.stopPropagation()}
              >
                {MENU_DATA[activeMenu].map((entry, index) => {
                  if (entry.type === "separator") {
                    return (
                      <div
                        key={`${activeMenu}-sep-${index}`}
                        className="yahoo-header-dropdown-separator"
                      />
                    );
                  }
                  const handleEntryClick = () => {
                    if (entry.disabled) return;
                    if (entry.label === "Sign Out") {
                      handleSignOut();
                      return;
                    }
                    if (entry.label === "Add a Contact") {
                      openAddFriends();
                      setActiveMenu(null);
                      return;
                    }
                    setActiveMenu(null);
                  };
                  return (
                    <div
                      key={`${activeMenu}-${entry.label}-${index}`}
                      className={`yahoo-header-dropdown-item${entry.disabled ? " is-disabled" : ""}`}
                      onClick={handleEntryClick}
                      role="menuitem"
                      tabIndex={-1}
                    >
                      <span
                        className={`yahoo-header-dropdown-marker${entry.selected ? " is-selected" : ""}`}
                        aria-hidden="true"
                      />
                      <span className="yahoo-header-dropdown-label">{entry.label}</span>
                      <span className="yahoo-header-dropdown-shortcut">
                        {entry.shortcut || ""}
                      </span>
                      <span className="yahoo-header-dropdown-submenu" aria-hidden="true">
                        {entry.submenu ? ">" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className={`yahoo-body ${isSignedIn ? "is-signed-in" : ""}`}>
          {isSignedIn ? (
            <YahooSignedIn
              username={signedInUser || username.trim()}
              onOpenConversation={openConversation}
              onAddContact={openAddFriends}
              friends={friendContacts}
            />
          ) : (
            <>
              <img
                src={isSigningIn && showAfterLogin ? yahooAfterLoginImage : yahooLoginImage}
                alt="Yahoo Messenger"
                className={`yahoo-login-image${
                  isSigningIn && showAfterLogin ? " is-afterlogin" : ""
                }`}
                draggable="false"
              />

              <div className="yahoo-form">
                <label className="yahoo-label" htmlFor={`yahoo-id-${windowId}`}>
                  Yahoo! <span className="yahoo-accelerator">I</span>D:
                </label>
                <input
                  id={`yahoo-id-${windowId}`}
                  className="yahoo-input"
                  type="text"
                  autoComplete="off"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
                <label className="yahoo-label" htmlFor={`yahoo-password-${windowId}`}>
                  <span className="yahoo-accelerator">P</span>assword:
                </label>
                <input
                  id={`yahoo-password-${windowId}`}
                  className="yahoo-input"
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSignIn();
                    }
                  }}
                />
                <div className="yahoo-options">
                  <label className="yahoo-option">
                    <input type="checkbox" defaultChecked />
                    <span>
                      <span className="yahoo-accelerator">R</span>emember my ID & password
                    </span>
                  </label>
                  <label className="yahoo-option">
                    <input type="checkbox" />
                    <span>
                      Sign in <span className="yahoo-accelerator">a</span>utomatically
                    </span>
                  </label>
                  <label className="yahoo-option">
                    <input type="checkbox" />
                    <span>
                      Sign in as in<span className="yahoo-accelerator">v</span>isible to everyone
                    </span>
                  </label>
                </div>
                <button type="button" className="yahoo-signin" onClick={handleSignIn}>
                  <span className="yahoo-accelerator">S</span>ign In
                </button>
                <div className="yahoo-language">
                  <span className="yahoo-language-label">
                    L<span className="yahoo-accelerator">a</span>nguage:
                  </span>
                  <select className="yahoo-language-select" defaultValue="en-us">
                    <option value="en-us">English (U.S.)</option>
                  </select>
                </div>
                <div className="yahoo-links-bottom">
                  <button type="button" className="yahoo-link">
                    Get a new Yahoo! ID...
                  </button>
                  <button type="button" className="yahoo-link is-bottom">
                    Forgot your password?
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
      </div>
      {activeConversation ? (
        <YahooConversationWindow
          windowId="yahoo-conversation-window"
          title={conversationTitleText || activeConversation.contactName}
          contactName={activeConversation.contactName}
          contactImage={activeConversation.icon}
          username={signedInUser || username.trim() || "angelo_lucaci"}
          messages={activeConversation.messages || []}
          draft={activeConversation.draft || ""}
          onDraftChange={(value) => updateConversationDraft(activeConversation.id, value)}
          onSendMessage={(text) =>
            sendConversationMessage(
              activeConversation.id,
              text ?? activeConversation.draft ?? ""
            )
          }
          onBuzzMessage={() => sendBuzzMessage(activeConversation.id)}
          tabs={conversations.map((conversation) => ({
            id: conversation.id,
            label: conversation.contactName,
            icon: conversation.icon,
          }))}
          activeTabId={activeConversation.id}
          onTabSelect={handleConversationTabSelect}
          zIndex={zIndex + 1}
          isActive={isActive && !isConversationWindowMinimized}
          isMinimized={isConversationWindowMinimized}
          onClose={closeConversationWindow}
          onMinimize={minimizeConversation}
          onMaximize={() => bringSubWindowToFront("conversation")}
          onMouseDown={() => bringSubWindowToFront("conversation")}
        />
      ) : null}
      {isAddFriendsOpen ? (
        <YahooAddFriendsWindow
          zIndex={getSubWindowZIndex("addfriends")}
          isActive={isAddFriendsActive}
          isMinimized={isMinimized}
          onClose={closeAddFriends}
          onAddFriend={handleAddFriend}
          onMouseDown={() => bringSubWindowToFront("addfriends")}
        />
      ) : null}
    </>
  );
};

export default YahooWindow;
