import React, { useEffect, useRef, useState } from "react";
import minimizeIcon from "../../../../assets/yahoo/header/window-minimize.webp";
import maximizeIcon from "../../../../assets/yahoo/header/maximise.webp";
import closeIcon from "../../../../assets/yahoo/header/close.webp";
import facebookIcon from "../../../../assets/yahoo/facebook.webp";
import twitterIcon from "../../../../assets/yahoo/twitter.webp";
import ResizeHandles from "../../ResizeHandles";
import useWindowResize from "../../hooks/useWindowResize";
import { getDesktopPoint } from "../../utils/desktopTransform";
import "../../../../styles/desktop/window.css";
import "../../../../styles/desktop/apps/yahoo/yahoo.css";
import "../../../../styles/desktop/apps/yahoo/yahoo-preferences.css";

const WINDOW_SIZE = { width: 600, height: 580 };

const getDefaultPosition = () => {
  if (typeof window === "undefined") return { x: 280, y: 110 };
  return {
    x: Math.max(80, Math.round((window.innerWidth - WINDOW_SIZE.width) / 2)),
    y: Math.max(80, Math.round((window.innerHeight - WINDOW_SIZE.height - 30) / 2)),
  };
};

const CATEGORY_ITEMS = [
  "General",
  "Alerts & Sounds",
  "Appearance",
  "Connected Networks",
  "Connection",
  "Conversation History",
  "Ignore List",
  "Language",
  "Messages",
  "Mobile",
  "Privacy",
  "Video & Voice",
  "Webcam Broadcast",
  "Yahoo! Music",
  "Yahoo! Updates",
];
const DEFAULT_LANGUAGE = "English (U.S.)";
const LANGUAGE_OPTIONS = [
  "English (U.S.)",
  "English (UK)",
  "Deutsch",
  "Espanol",
  "Francais",
  "Italiano",
  "Nederlands",
  "Portugues (Brasil)",
  "Portugues (Portugal)",
  "Dansk",
  "Svenska",
  "Norsk",
  "Suomi",
  "Magyar",
  "Polski",
  "Turkce",
];
const DEFAULT_MOBILE_COUNTRY = "United States (+1)";
const MOBILE_COUNTRY_OPTIONS = [
  "United States (+1)",
  "Canada (+1)",
  "United Kingdom (+44)",
  "Romania (+40)",
  "Germany (+49)",
  "France (+33)",
  "Italy (+39)",
  "Spain (+34)",
];

const YahooPreferencesWindow = ({
  windowId = "yahoo-preferences-window",
  onClose,
  onMinimize,
  onMaximize,
  zIndex,
  onMouseDown,
  isActive = true,
  isMinimized = false,
}) => {
  const [activeCategory, setActiveCategory] = useState("General");
  const [activeAlertIndex, setActiveAlertIndex] = useState(0);
  const [languageDraft, setLanguageDraft] = useState(DEFAULT_LANGUAGE);
  const [savedLanguage, setSavedLanguage] = useState(DEFAULT_LANGUAGE);
  const [mobileCountryDraft, setMobileCountryDraft] = useState(DEFAULT_MOBILE_COUNTRY);
  const [mobileNumberDraft, setMobileNumberDraft] = useState("");
  const [mobileCodeDraft, setMobileCodeDraft] = useState("");
  const [mobileVerifiedDraft, setMobileVerifiedDraft] = useState(false);
  const [mobileSignInOnExitDraft, setMobileSignInOnExitDraft] = useState(false);
  const [mobileForwardOfflineDraft, setMobileForwardOfflineDraft] = useState(false);
  const [savedMobileCountry, setSavedMobileCountry] = useState(DEFAULT_MOBILE_COUNTRY);
  const [savedMobileNumber, setSavedMobileNumber] = useState("");
  const [savedMobileVerified, setSavedMobileVerified] = useState(false);
  const [savedMobileSignInOnExit, setSavedMobileSignInOnExit] = useState(false);
  const [savedMobileForwardOffline, setSavedMobileForwardOffline] = useState(false);
  const [musicShowTrackDraft, setMusicShowTrackDraft] = useState(true);
  const [musicShareWithContactsDraft, setMusicShareWithContactsDraft] = useState(true);
  const [musicAutoDetectDraft, setMusicAutoDetectDraft] = useState(true);
  const [musicPlayerDraft, setMusicPlayerDraft] = useState("Windows Media Player");
  const [savedMusicShowTrack, setSavedMusicShowTrack] = useState(true);
  const [savedMusicShareWithContacts, setSavedMusicShareWithContacts] = useState(true);
  const [savedMusicAutoDetect, setSavedMusicAutoDetect] = useState(true);
  const [savedMusicPlayer, setSavedMusicPlayer] = useState("Windows Media Player");
  const [isMusicUnavailablePopupOpen, setIsMusicUnavailablePopupOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState(getDefaultPosition);
  const [size, setSize] = useState(WINDOW_SIZE);
  const dragOffset = useRef({ x: 0, y: 0 });
  const originalPosition = useRef(getDefaultPosition());
  const originalSize = useRef(WINDOW_SIZE);

  const { startResize } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 420,
    minHeight: 420,
    isMaximized,
    onFocus: () => onMouseDown?.(windowId),
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

  const handleMouseDown = (event) => {
    if (isMaximized || event.button !== 0) return;
    setIsDragging(true);
    const point = getDesktopPoint(event);
    dragOffset.current = {
      x: point.x - position.x,
      y: point.y - position.y,
    };
    onMouseDown?.(windowId);
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
    setIsMaximized((prev) => !prev);
    onMaximize?.(windowId);
  };

  useEffect(() => {
    if (!isDragging) return;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const hasLanguageChanges = languageDraft !== savedLanguage;
  const hasMobileChanges =
    mobileCountryDraft !== savedMobileCountry ||
    mobileNumberDraft !== savedMobileNumber ||
    mobileVerifiedDraft !== savedMobileVerified ||
    mobileSignInOnExitDraft !== savedMobileSignInOnExit ||
    mobileForwardOfflineDraft !== savedMobileForwardOffline;
  const hasMusicChanges =
    musicShowTrackDraft !== savedMusicShowTrack ||
    musicShareWithContactsDraft !== savedMusicShareWithContacts ||
    musicAutoDetectDraft !== savedMusicAutoDetect ||
    musicPlayerDraft !== savedMusicPlayer;

  const applyCategoryIfNeeded = () => {
    if (activeCategory === "Language") {
      if (!hasLanguageChanges) return;
      setSavedLanguage(languageDraft);
      return;
    }
    if (activeCategory === "Mobile") {
      if (!hasMobileChanges) return;
      setSavedMobileCountry(mobileCountryDraft);
      setSavedMobileNumber(mobileNumberDraft);
      setSavedMobileVerified(mobileVerifiedDraft && Boolean(mobileNumberDraft.trim()));
      setSavedMobileSignInOnExit(mobileSignInOnExitDraft);
      setSavedMobileForwardOffline(mobileForwardOfflineDraft);
      return;
    }
    if (activeCategory === "Yahoo! Music") {
      if (!hasMusicChanges) return;
      setSavedMusicShowTrack(musicShowTrackDraft);
      setSavedMusicShareWithContacts(musicShareWithContactsDraft);
      setSavedMusicAutoDetect(musicAutoDetectDraft);
      setSavedMusicPlayer(musicPlayerDraft);
    }
  };

  const handleOkClick = () => {
    applyCategoryIfNeeded();
    onClose?.(windowId);
  };

  const handleCancelClick = () => {
    if (activeCategory === "Language") {
      setLanguageDraft(savedLanguage);
    } else if (activeCategory === "Mobile") {
      setMobileCountryDraft(savedMobileCountry);
      setMobileNumberDraft(savedMobileNumber);
      setMobileCodeDraft("");
      setMobileVerifiedDraft(savedMobileVerified);
      setMobileSignInOnExitDraft(savedMobileSignInOnExit);
      setMobileForwardOfflineDraft(savedMobileForwardOffline);
    } else if (activeCategory === "Yahoo! Music") {
      setMusicShowTrackDraft(savedMusicShowTrack);
      setMusicShareWithContactsDraft(savedMusicShareWithContacts);
      setMusicAutoDetectDraft(savedMusicAutoDetect);
      setMusicPlayerDraft(savedMusicPlayer);
      setIsMusicUnavailablePopupOpen(false);
    }
    onClose?.(windowId);
  };

  const handleApplyClick = () => {
    applyCategoryIfNeeded();
  };

  const isApplyDisabled =
    (activeCategory === "Language" && !hasLanguageChanges) ||
    (activeCategory === "Mobile" && !hasMobileChanges) ||
    (activeCategory === "Yahoo! Music" && !hasMusicChanges) ||
    (activeCategory !== "Language" &&
      activeCategory !== "Mobile" &&
      activeCategory !== "Yahoo! Music");
  const mobileStatusLabel = savedMobileNumber
    ? savedMobileVerified
      ? "Verified"
      : "Pending verification"
    : "Not set up";

  useEffect(() => {
    if (activeCategory === "Yahoo! Music") return;
    setIsMusicUnavailablePopupOpen(false);
  }, [activeCategory]);

  return (
    <div
      className={`window yahoo-window yahoo-preferences-window${isActive ? "" : " is-inactive"}${
        isMaximized ? " maximized" : ""
      }`}
      style={{
        top: position.y,
        left: position.x,
        width: size.width,
        height: size.height,
        zIndex,
        display: isMinimized ? "none" : undefined,
      }}
      onMouseDown={() => onMouseDown?.(windowId)}
    >
      <div className="window-header" onMouseDown={handleMouseDown} onDoubleClick={toggleMaximize}>
        <div className="yahoo-header-top">
          <div className="window-title">
            <span>Yahoo! Messenger Preferences</span>
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
            <button className="window-btn close" onClick={() => onClose?.(windowId)}>
              <img src={closeIcon} alt="Close" />
            </button>
          </div>
        </div>
      </div>

      <div className="yahoo-preferences-body">
        <aside className="yahoo-preferences-sidebar">
          <div className="yahoo-preferences-category">Category:</div>
          <ul className="yahoo-preferences-list">
            {CATEGORY_ITEMS.map((item) => (
              <li key={item} className="yahoo-preferences-item">
                <button
                  type="button"
                  className={`yahoo-preferences-item-button${
                    item === activeCategory ? " is-active" : ""
                  }`}
                  onClick={() => setActiveCategory(item)}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="yahoo-preferences-panel">
          <div className="yahoo-preferences-panel-title">{activeCategory}</div>
          {activeCategory === "Connected Networks" ? (
            <div className="yahoo-preferences-networks">
              <div className="yahoo-preferences-network-card">
                <img
                  src={facebookIcon}
                  alt="Facebook"
                  className="yahoo-preferences-network-icon"
                  draggable="false"
                />
                <div className="yahoo-preferences-network-content">
                  <p>
                    Link to your Facebook account to chat with any of your Facebook friends who are
                    available to chat. You will also be able to see your Facebook news feed in the
                    Updates tab.
                  </p>
                  <div className="yahoo-preferences-network-actions">
                    <button type="button" className="yahoo-preferences-btn is-primary">
                      Link to Facebook
                    </button>
                    <button type="button" className="yahoo-preferences-link">
                      Learn More
                    </button>
                  </div>
                </div>
              </div>

              <div className="yahoo-preferences-network-card">
                <img
                  src={twitterIcon}
                  alt="Twitter"
                  className="yahoo-preferences-network-icon"
                  draggable="false"
                />
                <div className="yahoo-preferences-network-content">
                  <p>
                    Link to your Twitter account to post new tweets. You will also be able to see
                    new tweets in the Updates tab.
                  </p>
                  <button type="button" className="yahoo-preferences-link">
                    Manage My Twitter Connection
                  </button>
                </div>
              </div>
            </div>
          ) : activeCategory === "Privacy" ? (
            <div className="yahoo-preferences-privacy">
              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">
                  When I sign into Yahoo! Messenger
                </div>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" />
                  <span>Always sign in as invisible. (Appear offline to all users.)</span>
                </label>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" defaultChecked />
                  <span>Allow Yahoo! web sites to show when I am online.</span>
                </label>
              </div>

              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">Idle Status</div>
                <label className="yahoo-preferences-option yahoo-preferences-option-inline">
                  <input type="checkbox" defaultChecked />
                  <span>Show me as "Idle" if I don't use the computer for</span>
                  <input
                    type="number"
                    min="1"
                    className="yahoo-preferences-number"
                    defaultValue="15"
                  />
                  <span>minutes.</span>
                </label>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" />
                  <span>Do not show anyone how long I have been idle.</span>
                </label>
              </div>

              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">
                  Change my status automatically when I am
                </div>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" defaultChecked />
                  <span>Listening to LAUNCHcast Radio in Messenger.</span>
                </label>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" defaultChecked />
                  <span>Playing a game on the Yahoo! Games web site.</span>
                </label>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" defaultChecked />
                  <span>Showing my webcam, and display this message:</span>
                </label>
                <input
                  type="text"
                  className="yahoo-preferences-input"
                  defaultValue="View My Webcam"
                />
              </div>

              <label className="yahoo-preferences-option">
                <input type="checkbox" defaultChecked />
                <span>Allow plug-ins to set clickable status messages.</span>
              </label>

              <div className="yahoo-preferences-privacy-link">
                <button type="button" className="yahoo-preferences-link">
                  View the Yahoo! Privacy Policy...
                </button>
              </div>
            </div>
          ) : activeCategory === "Conversation History" ? (
            <div className="yahoo-preferences-history">
              <p className="yahoo-preferences-history-text">
                Yahoo! Messenger stores your conversations and calls online (like email),
                giving you easy access to your conversation history from any computer where
                you're signed in to Messenger.
              </p>
              <div className="yahoo-preferences-history-options">
                <label className="yahoo-preferences-option">
                  <input type="radio" name="yahoo-history" defaultChecked />
                  <span>Keep a history of my conversations</span>
                </label>
                <label className="yahoo-preferences-option">
                  <input type="radio" name="yahoo-history" />
                  <span>Do not keep a history of my conversations</span>
                </label>
              </div>
              <button type="button" className="yahoo-preferences-btn yahoo-preferences-history-btn">
                View Conversation History
              </button>
            </div>
          ) : activeCategory === "Video & Voice" ? (
            <div className="yahoo-preferences-video">
              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">Select devices</div>
                <div className="yahoo-preferences-device-row">
                  <span className="yahoo-preferences-device-label">Camera</span>
                  <span className="yahoo-preferences-device-icon">📷</span>
                  <select className="yahoo-preferences-select">
                    <option>System default - 1.3M HD WebCam</option>
                  </select>
                </div>
                <div className="yahoo-preferences-device-row">
                  <span className="yahoo-preferences-device-label">Microphone</span>
                  <span className="yahoo-preferences-device-icon">🎤</span>
                  <select className="yahoo-preferences-select">
                    <option>System default - Microphone (Realtek High Def)</option>
                  </select>
                </div>
                <div className="yahoo-preferences-device-row">
                  <span className="yahoo-preferences-device-label">Speakers</span>
                  <span className="yahoo-preferences-device-icon">🔊</span>
                  <select className="yahoo-preferences-select">
                    <option>System default - Speakers (Realtek High Def)</option>
                  </select>
                </div>
                <div className="yahoo-preferences-device-row">
                  <span className="yahoo-preferences-device-label">Ringer</span>
                  <span className="yahoo-preferences-device-icon">🔔</span>
                  <select className="yahoo-preferences-select">
                    <option>System default - Speakers (Realtek High Def)</option>
                  </select>
                </div>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" defaultChecked />
                  <span>Ring PC speaker</span>
                </label>
              </div>

              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">Test devices</div>
                <button type="button" className="yahoo-preferences-link">
                  Open Video and Voice Setup
                </button>
              </div>

              <label className="yahoo-preferences-option">
                <input type="checkbox" defaultChecked />
                <span>Allow USB devices to access Messenger</span>
              </label>
            </div>
          ) : activeCategory === "Alerts & Sounds" ? (
            <div className="yahoo-preferences-alerts">
              <label className="yahoo-preferences-option">
                <input type="checkbox" defaultChecked />
                <span>Enable alert sounds.</span>
              </label>

              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">Alert me when</div>
                <div className="yahoo-preferences-alerts-list">
                  {[
                    "A Messenger contact goes online",
                    "A Messenger contact goes offline",
                    "A Messenger contact buzzes me",
                    "I receive an Instant Message or SMS Message",
                    "I receive a personals alert",
                    "I receive a message in Yahoo! Mail",
                    "I receive a Yahoo! Calendar reminder",
                    "I receive an incoming video or voice call",
                  ].map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      className={`yahoo-preferences-alerts-item${
                        index === activeAlertIndex ? " is-selected" : ""
                      }`}
                      onClick={() => setActiveAlertIndex(index)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">Alert me by:</div>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" defaultChecked />
                  <span>Showing a message at the bottom right corner of screen</span>
                </label>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" />
                  <span>Displaying a dialog box</span>
                </label>
                <div className="yahoo-preferences-option yahoo-preferences-option-inline">
                  <input type="checkbox" defaultChecked />
                  <span>Playing a sound</span>
                  <input
                    type="text"
                    className="yahoo-preferences-input yahoo-preferences-sound-path"
                    defaultValue="C:\\Program...\\offline.wav"
                  />
                  <button type="button" className="yahoo-preferences-btn is-primary">
                    ▶
                  </button>
                  <button type="button" className="yahoo-preferences-btn">
                    Browse
                  </button>
                </div>
              </div>

              <label className="yahoo-preferences-option">
                <input type="checkbox" />
                <span>Mute Yahoo! Games sounds in Messenger by default.</span>
              </label>
              <label className="yahoo-preferences-option">
                <input type="checkbox" />
                <span>Alert me before downloading a Yahoo! Messenger update.</span>
              </label>
            </div>
          ) : activeCategory === "Ignore List" ? (
            <div className="yahoo-preferences-ignore">
              <p className="yahoo-preferences-history-text">
                You can prevent unwanted communications in Yahoo! Messenger by ignoring people.
              </p>

              <div className="yahoo-preferences-group">
                <label className="yahoo-preferences-option">
                  <input type="radio" name="yahoo-ignore" defaultChecked />
                  <span>Ignore anyone who is not in my Yahoo! Contacts.</span>
                </label>
                <p className="yahoo-preferences-hint">
                  You will only receive messages from people who are in your Messenger List or
                  Address Book.
                </p>
                <label className="yahoo-preferences-option">
                  <input type="radio" name="yahoo-ignore" />
                  <span>Ignore only the people below:</span>
                </label>
                <div className="yahoo-preferences-ignore-list">
                  <div className="yahoo-preferences-ignore-box" />
                  <div className="yahoo-preferences-ignore-actions">
                    <button type="button" className="yahoo-preferences-btn">
                      Add
                    </button>
                    <button type="button" className="yahoo-preferences-btn">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : activeCategory === "Language" ? (
            <div className="yahoo-preferences-language">
              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">Select Language</div>
                <label className="yahoo-preferences-language-row">
                  <span className="yahoo-preferences-language-label">Language:</span>
                  <select
                    className="yahoo-preferences-select"
                    value={languageDraft}
                    onChange={(event) => setLanguageDraft(event.target.value)}
                  >
                    {LANGUAGE_OPTIONS.map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="yahoo-preferences-hint">
                  Changes take effect after restart.
                </p>
              </div>
              <div className="yahoo-preferences-language-current">
                Current Messenger language: <strong>{savedLanguage}</strong>
              </div>
            </div>
          ) : activeCategory === "Mobile" ? (
            <div className="yahoo-preferences-mobile">
              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">Mobile Device Setup</div>
                <div className="yahoo-preferences-mobile-row">
                  <span className="yahoo-preferences-mobile-label">Country:</span>
                  <select
                    className="yahoo-preferences-select"
                    value={mobileCountryDraft}
                    onChange={(event) => setMobileCountryDraft(event.target.value)}
                  >
                    {MOBILE_COUNTRY_OPTIONS.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="yahoo-preferences-mobile-row">
                  <span className="yahoo-preferences-mobile-label">Mobile number:</span>
                  <input
                    type="text"
                    className="yahoo-preferences-input yahoo-preferences-mobile-input"
                    value={mobileNumberDraft}
                    placeholder="(555) 555-1212"
                    onChange={(event) => {
                      setMobileNumberDraft(event.target.value);
                      if (!event.target.value.trim()) {
                        setMobileVerifiedDraft(false);
                      }
                    }}
                  />
                </div>
                <div className="yahoo-preferences-mobile-row yahoo-preferences-mobile-inline">
                  <span className="yahoo-preferences-mobile-label">Verification code:</span>
                  <input
                    type="text"
                    className="yahoo-preferences-input yahoo-preferences-mobile-input"
                    value={mobileCodeDraft}
                    placeholder="Enter code"
                    onChange={(event) => setMobileCodeDraft(event.target.value)}
                  />
                  <button
                    type="button"
                    className="yahoo-preferences-btn"
                    onClick={() => {
                      if (!mobileNumberDraft.trim()) return;
                      setMobileVerifiedDraft(mobileCodeDraft.trim().length >= 4);
                    }}
                    disabled={!mobileNumberDraft.trim()}
                  >
                    Verify
                  </button>
                </div>
                <div className="yahoo-preferences-mobile-status">
                  Mobile status: <strong>{mobileStatusLabel}</strong>
                </div>
                <p className="yahoo-preferences-hint">
                  Carrier SMS charges may apply.
                </p>
              </div>

              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">When I leave Messenger</div>
                <label className="yahoo-preferences-option">
                  <input
                    type="checkbox"
                    checked={mobileSignInOnExitDraft}
                    onChange={(event) => setMobileSignInOnExitDraft(event.target.checked)}
                  />
                  <span>Always sign into my mobile device when I exit Messenger.</span>
                </label>
                <label className="yahoo-preferences-option">
                  <input
                    type="checkbox"
                    checked={mobileForwardOfflineDraft}
                    onChange={(event) => setMobileForwardOfflineDraft(event.target.checked)}
                  />
                  <span>Forward IM alerts to my phone when I am offline.</span>
                </label>
              </div>

              <div className="yahoo-preferences-mobile-actions">
                <button
                  type="button"
                  className="yahoo-preferences-btn"
                  onClick={() => {
                    setMobileNumberDraft("");
                    setMobileCodeDraft("");
                    setMobileVerifiedDraft(false);
                    setMobileSignInOnExitDraft(false);
                    setMobileForwardOfflineDraft(false);
                  }}
                >
                  Remove Mobile Device
                </button>
              </div>
            </div>
          ) : activeCategory === "Yahoo! Music" ? (
            <div className="yahoo-preferences-music">
              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">Yahoo! Music Integration</div>
                <label className="yahoo-preferences-option">
                  <input
                    type="checkbox"
                    checked={musicShowTrackDraft}
                    onChange={(event) => setMusicShowTrackDraft(event.target.checked)}
                  />
                  <span>Show what I'm listening to in my Messenger status.</span>
                </label>
                <label className="yahoo-preferences-option">
                  <input
                    type="checkbox"
                    checked={musicShareWithContactsDraft}
                    onChange={(event) => setMusicShareWithContactsDraft(event.target.checked)}
                  />
                  <span>Allow contacts to see my current song.</span>
                </label>
                <label className="yahoo-preferences-option">
                  <input
                    type="checkbox"
                    checked={musicAutoDetectDraft}
                    onChange={(event) => setMusicAutoDetectDraft(event.target.checked)}
                  />
                  <span>Detect music player automatically.</span>
                </label>
                <div className="yahoo-preferences-music-player-row">
                  <span className="yahoo-preferences-mobile-label">Preferred player:</span>
                  <select
                    className="yahoo-preferences-select"
                    value={musicPlayerDraft}
                    onChange={(event) => setMusicPlayerDraft(event.target.value)}
                    disabled={musicAutoDetectDraft}
                  >
                    <option>Windows Media Player</option>
                    <option>Winamp</option>
                    <option>iTunes</option>
                    <option>RealPlayer</option>
                  </select>
                </div>
              </div>
              <div className="yahoo-preferences-group">
                <button
                  type="button"
                  className="yahoo-preferences-btn"
                  onClick={() => setIsMusicUnavailablePopupOpen(true)}
                >
                  Open Yahoo! Music
                </button>
                {isMusicUnavailablePopupOpen ? (
                  <div className="yahoo-preferences-music-unavailable">
                    <div className="yahoo-preferences-music-unavailable-title">
                      Yahoo! Music
                    </div>
                    <div className="yahoo-preferences-music-unavailable-body">
                      Yahoo! Music service is no longer available.
                    </div>
                    <button
                      type="button"
                      className="yahoo-preferences-btn"
                      onClick={() => setIsMusicUnavailablePopupOpen(false)}
                    >
                      OK
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">When I start up my computer</div>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" defaultChecked />
                  <span>Automatically start Yahoo! Messenger</span>
                </label>
              </div>

              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">
                  When I sign in to Yahoo! Messenger
                </div>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" />
                  <span>Stand by and wait until I connect to the Internet</span>
                </label>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" defaultChecked />
                  <span>Show Yahoo! Messenger Insider</span>
                </label>
              </div>

              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">
                  When I'm using Yahoo! Messenger
                </div>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" />
                  <span>Keep Yahoo! Messenger on top of other applications</span>
                </label>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" defaultChecked />
                  <span>Automatically sign me in when I click a Yahoo! link in Messenger</span>
                </label>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" />
                  <span>Remove the taskbar button when I minimize the main window</span>
                </label>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" defaultChecked />
                  <span>Enable system-wide shortcut keys to activate Messenger</span>
                </label>
              </div>

              <div className="yahoo-preferences-group">
                <div className="yahoo-preferences-group-title">
                  Signing out of Yahoo! Messenger
                </div>
                <label className="yahoo-preferences-option">
                  <input type="checkbox" />
                  <span>Sign out of Messenger when I close the main window</span>
                </label>
                <p className="yahoo-preferences-hint">
                  If you are signed in to Yahoo! Messenger at multiple places, you can choose where
                  to sign out.
                </p>
                <div className="yahoo-preferences-radios">
                  <label className="yahoo-preferences-option">
                    <input type="radio" name="yahoo-signout" />
                    <span>Always sign out here</span>
                  </label>
                  <label className="yahoo-preferences-option">
                    <input type="radio" name="yahoo-signout" />
                    <span>Always sign out everywhere</span>
                  </label>
                  <label className="yahoo-preferences-option">
                    <input type="radio" name="yahoo-signout" defaultChecked />
                    <span>Ask every time</span>
                  </label>
                </div>
              </div>
            </>
          )}

          <div className="yahoo-preferences-actions">
            <button
              type="button"
              className="yahoo-preferences-btn is-primary"
              onClick={handleOkClick}
            >
              OK
            </button>
            <button type="button" className="yahoo-preferences-btn" onClick={handleCancelClick}>
              Cancel
            </button>
            <button
              type="button"
              className="yahoo-preferences-btn"
              onClick={handleApplyClick}
              disabled={isApplyDisabled}
            >
              Apply
            </button>
          </div>
        </section>
      </div>

      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default YahooPreferencesWindow;
