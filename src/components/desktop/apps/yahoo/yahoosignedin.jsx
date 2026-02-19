import React, { useEffect, useMemo, useRef, useState } from "react";
import userAvatar from "../../../../assets/yahoo/soccer.png";
import chatgptIcon from "../../../../assets/yahoo/chatgpt.jpg";
import geminiIcon from "../../../../assets/about-me/gemini.png";
import diceIcon from "../../../../assets/yahoo/dice.png";
import emailIcon from "../../../../assets/yahoo/fastemail.png";
import addFriendIcon from "../../../../assets/yahoo/addfriend.png";
import addFriendHoveredIcon from "../../../../assets/yahoo/addfriendhovered.png";
import contactViewIcon from "../../../../assets/yahoo/contactview.png";
import phoneIcon from "../../../../assets/yahoo/phone.png";
import searchIcon from "../../../../assets/yahoo/search.png";
import facebookIcon from "../../../../assets/yahoo/facebook.png";
import twitterIcon from "../../../../assets/yahoo/twitter.webp";
import yahooUpdatesIcon from "../../../../assets/yahoo/yahooapp.webp";
import yahooShareIcon from "../../../../assets/yahoo/yahooicon.webp";
import yahooBadgeIcon from "../../../../assets/yahoo/Yahoo-icon.png";
import yahooWatchIcon from "../../../../assets/yahoo/yahoowatch.png";
import downArrowIcon from "../../../../assets/yahoo/down-arrow.png";
import rightArrowIcon from "../../../../assets/yahoo/right-arrow.png";
import closeIcon from "../../../../assets/yahoo/header/close.png";
import YahooEmoticonMenu from "./emoticonmenu";
import "../../../../styles/desktop/apps/yahoo/yahoosignedin.css";

const DEFAULT_STATUS = "This is a drill";
const YAHOO_MAIL_URL = "https://mail.yahoo.com";
const GAMES_PORTAL_URL = "https://www.crazygames.com/";
const PRESENCE_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "invisible", label: "Invisible" },
];
const SHARE_TARGETS = [
  { label: "Yahoo! Messenger", icon: yahooShareIcon, iconClass: "is-yahoo" },
  { label: "Yahoo! Updates", icon: yahooUpdatesIcon, iconClass: "is-yahoo-updates" },
  { label: "Facebook", icon: facebookIcon },
  { label: "Twitter", icon: twitterIcon },
];
export const DEFAULT_FRIEND_CONTACTS = [
  { id: "chatgpt", name: "ChatGPT", icon: chatgptIcon, isFriend: true, status: "online" },
  { id: "gemini", name: "Gemini", icon: geminiIcon, isFriend: true, status: "offline" },
];

const YahooSignedIn = ({
  username = "angelo_lucaci",
  onOpenConversation,
  onAddContact,
  friends = DEFAULT_FRIEND_CONTACTS,
  presence: controlledPresence,
  onPresenceChange,
  noIncomingCalls = false,
  openInsiderRequestId = 0,
  openContactDetailsRequestId = 0,
  onContactDetailsSave,
}) => {
  const [activeTab, setActiveTab] = useState("contacts");
  const [statusText, setStatusText] = useState(DEFAULT_STATUS);
  const [uncontrolledPresence, setUncontrolledPresence] = useState("online");
  const [isPresenceMenuOpen, setIsPresenceMenuOpen] = useState(false);
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const [isShareToMenuOpen, setIsShareToMenuOpen] = useState(false);
  const [isShareEmoteOpen, setIsShareEmoteOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [isAddFriendHovered, setIsAddFriendHovered] = useState(false);
  const [recentContacts, setRecentContacts] = useState([]);
  const [isContactViewMenuOpen, setIsContactViewMenuOpen] = useState(false);
  const [contactViewMode, setContactViewMode] = useState("detailed");
  const [showRecentContacts, setShowRecentContacts] = useState(true);
  const [showOfflineContacts, setShowOfflineContacts] = useState(true);
  const [sortBy, setSortBy] = useState("status");
  const [contactSearch, setContactSearch] = useState("");
  const [isPhonePopupOpen, setIsPhonePopupOpen] = useState(false);
  const [isInsiderPopupOpen, setIsInsiderPopupOpen] = useState(false);
  const [isContactDetailsOpen, setIsContactDetailsOpen] = useState(false);
  const [isContactDetailsDragging, setIsContactDetailsDragging] = useState(false);
  const [contactDetailsPosition, setContactDetailsPosition] = useState({ x: 0, y: 22 });
  const [contactDetailsUsernameDraft, setContactDetailsUsernameDraft] = useState("");
  const [contactDetailsStatusDraft, setContactDetailsStatusDraft] = useState("");
  const [contactDetailsPresenceDraft, setContactDetailsPresenceDraft] = useState("online");
  const [collapsedGroups, setCollapsedGroups] = useState({
    recent: false,
    friends: false,
    addressBook: true,
  });
  const statusButtonRef = useRef(null);
  const sharePanelRef = useRef(null);
  const shareToMenuRef = useRef(null);
  const shareToButtonRef = useRef(null);
  const shareEmoteRef = useRef(null);
  const shareEmoteMenuRef = useRef(null);
  const presenceTriggerRef = useRef(null);
  const presenceMenuRef = useRef(null);
  const contactViewButtonRef = useRef(null);
  const contactViewMenuRef = useRef(null);
  const phonePopupRef = useRef(null);
  const phoneTriggerRef = useRef(null);
  const insiderPopupRef = useRef(null);
  const insiderTriggerRef = useRef(null);
  const contactDetailsPopupRef = useRef(null);
  const contactDetailsHostRef = useRef(null);
  const contactDetailsDragOffsetRef = useRef({ x: 0, y: 0 });
  const presence = controlledPresence ?? uncontrolledPresence;

  const normalizeContactStatus = (contact) => {
    const rawStatus = String(contact?.status || "").toLowerCase();
    if (rawStatus === "offline" || rawStatus === "invisible") {
      return "offline";
    }
    if (rawStatus === "online") {
      return "online";
    }
    return contact?.id === "gemini" ? "offline" : "online";
  };

  const sortContacts = (contacts) => {
    const ordered = [...contacts];
    if (sortBy === "name") {
      ordered.sort((a, b) => a.name.localeCompare(b.name));
      return ordered;
    }

    ordered.sort((a, b) => {
      const statusA = a.status === "offline" ? 1 : 0;
      const statusB = b.status === "offline" ? 1 : 0;
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      return a.name.localeCompare(b.name);
    });
    return ordered;
  };

  const normalizedFriends = useMemo(
    () => friends.map((contact) => ({ ...contact, status: normalizeContactStatus(contact) })),
    [friends]
  );

  const normalizedRecentContacts = useMemo(
    () => recentContacts.map((contact) => ({ ...contact, status: normalizeContactStatus(contact) })),
    [recentContacts]
  );
  const normalizedContactSearch = contactSearch.trim().toLowerCase();

  const displayedFriends = useMemo(() => {
    const visibleByStatus = showOfflineContacts
      ? normalizedFriends
      : normalizedFriends.filter((contact) => contact.status !== "offline");
    const visibleBySearch = normalizedContactSearch
      ? visibleByStatus.filter((contact) =>
          contact.name.toLowerCase().includes(normalizedContactSearch)
        )
      : visibleByStatus;
    return sortContacts(visibleBySearch);
  }, [normalizedContactSearch, normalizedFriends, showOfflineContacts, sortBy]);

  const displayedRecentContacts = useMemo(() => {
    const visibleByStatus = showOfflineContacts
      ? normalizedRecentContacts
      : normalizedRecentContacts.filter((contact) => contact.status !== "offline");
    const visibleBySearch = normalizedContactSearch
      ? visibleByStatus.filter((contact) =>
          contact.name.toLowerCase().includes(normalizedContactSearch)
        )
      : visibleByStatus;
    return sortContacts(visibleBySearch);
  }, [normalizedContactSearch, normalizedRecentContacts, showOfflineContacts, sortBy]);

  const updatesFeed = useMemo(() => {
    const updates = [];

    if (statusText.trim() && statusText.trim() !== DEFAULT_STATUS) {
      updates.push({
        id: "my-status",
        icon: userAvatar,
        name: username,
        text: `updated status to "${statusText.trim()}"`,
        time: "Just now",
        status: presence === "invisible" ? "offline" : "online",
        contact: null,
      });
    }

    normalizedFriends.forEach((contact) => {
      updates.push({
        id: `presence-${contact.id}`,
        icon: contact.icon,
        name: contact.name,
        text: contact.status === "offline" ? "went offline" : "is online",
        time: contact.status === "offline" ? "20 min ago" : "Just now",
        status: contact.status,
        contact,
      });
    });

    normalizedRecentContacts.forEach((contact) => {
      updates.push({
        id: `recent-chat-${contact.id}`,
        icon: contact.icon,
        name: contact.name,
        text: "was in your recent conversations",
        time: "Earlier",
        status: contact.status,
        contact,
      });
    });

    return updates.slice(0, 12);
  }, [normalizedFriends, normalizedRecentContacts, presence, statusText, username]);

  const displayedUpdates = useMemo(() => {
    if (!normalizedContactSearch) return updatesFeed;
    return updatesFeed.filter((update) =>
      `${update.name} ${update.text}`.toLowerCase().includes(normalizedContactSearch)
    );
  }, [normalizedContactSearch, updatesFeed]);

  const handleStatusIconClick = () => {
    setIsPresenceMenuOpen(false);
    setIsContactViewMenuOpen(false);
    setIsSharePanelOpen((prev) => {
      const next = !prev;
      if (!next) {
        setIsShareToMenuOpen(false);
        setIsShareEmoteOpen(false);
      }
      return next;
    });
  };

  const handleShareEmoteSelect = (emote) => {
    const token = emote?.code || "";
    if (token) {
      setStatusText((prev) => {
        const spacer = prev && !prev.endsWith(" ") ? " " : "";
        return `${prev}${spacer}${token}`;
      });
    }
    setIsShareEmoteOpen(false);
  };

  const applyPresence = (nextPresence) => {
    if (typeof onPresenceChange === "function") {
      onPresenceChange(nextPresence);
    } else {
      setUncontrolledPresence(nextPresence);
    }
  };

  const handlePresenceSelect = (nextPresence) => {
    applyPresence(nextPresence);
    setIsPresenceMenuOpen(false);
  };

  const handleOpenMailInbox = () => {
    if (typeof window === "undefined") return;
    window.open(YAHOO_MAIL_URL, "_blank", "noopener,noreferrer");
  };

  const handleOpenGamesPortal = () => {
    if (typeof window === "undefined") return;
    window.open(GAMES_PORTAL_URL, "_blank", "noopener,noreferrer");
  };

  const handlePhoneIconClick = () => {
    setIsPhonePopupOpen((prev) => !prev);
  };

  const handleInsiderClick = () => {
    setIsInsiderPopupOpen((prev) => !prev);
  };

  const handleSaveContactDetails = () => {
    const nextUsername = contactDetailsUsernameDraft.trim() || username;
    setStatusText(contactDetailsStatusDraft);
    applyPresence(contactDetailsPresenceDraft);
    onContactDetailsSave?.({
      username: nextUsername,
      statusText: contactDetailsStatusDraft,
      presence: contactDetailsPresenceDraft,
    });
    setIsContactDetailsOpen(false);
  };

  const handleContactDetailsHeaderMouseDown = (event) => {
    if (event.button !== 0) return;
    const popupRect = contactDetailsPopupRef.current?.getBoundingClientRect();
    if (!popupRect) return;
    contactDetailsDragOffsetRef.current = {
      x: event.clientX - popupRect.left,
      y: event.clientY - popupRect.top,
    };
    setIsContactDetailsDragging(true);
    event.preventDefault();
  };

  const handleContactViewToggle = () => {
    if (activeTab !== "contacts") return;
    setIsPresenceMenuOpen(false);
    setIsShareToMenuOpen(false);
    setIsShareEmoteOpen(false);
    setIsSharePanelOpen(false);
    setIsContactViewMenuOpen((prev) => !prev);
  };

  const handleToggleShowRecentContacts = () => {
    setShowRecentContacts((prev) => !prev);
    setIsContactViewMenuOpen(false);
  };

  const handleToggleShowOfflineContacts = () => {
    setShowOfflineContacts((prev) => !prev);
    setIsContactViewMenuOpen(false);
  };

  const handleContactViewModeSelect = (mode) => {
    setContactViewMode(mode);
    setIsContactViewMenuOpen(false);
  };

  const handleSortBySelect = (nextSortBy) => {
    setSortBy(nextSortBy);
    setIsContactViewMenuOpen(false);
  };

  const handleTabSelect = (nextTab) => {
    setActiveTab(nextTab);
    setIsContactViewMenuOpen(false);
  };

  useEffect(() => {
    if (!openInsiderRequestId) return;
    setIsInsiderPopupOpen(true);
  }, [openInsiderRequestId]);

  useEffect(() => {
    if (!openContactDetailsRequestId) return;
    setContactDetailsUsernameDraft(username);
    setContactDetailsStatusDraft(statusText);
    setContactDetailsPresenceDraft(presence);
    setIsContactDetailsOpen(true);
    requestAnimationFrame(() => {
      const hostRect = contactDetailsHostRef.current?.getBoundingClientRect();
      const popupWidth = contactDetailsPopupRef.current?.offsetWidth || 420;
      const alignedX = (hostRect?.width || popupWidth) - popupWidth;
      setContactDetailsPosition({ x: alignedX, y: 22 });
    });
  }, [openContactDetailsRequestId, presence, statusText, username]);

  useEffect(() => {
    if (!isContactDetailsDragging) return;
    const handleMouseMove = (event) => {
      const hostRect = contactDetailsHostRef.current?.getBoundingClientRect();
      if (!hostRect) return;
      const nextX = event.clientX - hostRect.left - contactDetailsDragOffsetRef.current.x;
      const nextY = event.clientY - hostRect.top - contactDetailsDragOffsetRef.current.y;
      setContactDetailsPosition({
        x: Math.round(nextX),
        y: Math.round(nextY),
      });
    };
    const handleMouseUp = () => {
      setIsContactDetailsDragging(false);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isContactDetailsDragging]);

  useEffect(() => {
    if (
      !isSharePanelOpen &&
      !isShareToMenuOpen &&
      !isShareEmoteOpen &&
      !isPresenceMenuOpen &&
      !isContactViewMenuOpen &&
      !isPhonePopupOpen &&
      !isInsiderPopupOpen &&
      !isContactDetailsOpen
    ) {
      return;
    }

    const handleOutsideClick = (event) => {
      if (sharePanelRef.current?.contains(event.target)) return;
      if (statusButtonRef.current?.contains(event.target)) return;
      if (shareToMenuRef.current?.contains(event.target)) return;
      if (shareToButtonRef.current?.contains(event.target)) return;
      if (shareEmoteMenuRef.current?.contains(event.target)) return;
      if (shareEmoteRef.current?.contains(event.target)) return;
      if (presenceMenuRef.current?.contains(event.target)) return;
      if (presenceTriggerRef.current?.contains(event.target)) return;
      if (contactViewMenuRef.current?.contains(event.target)) return;
      if (contactViewButtonRef.current?.contains(event.target)) return;
      if (phonePopupRef.current?.contains(event.target)) return;
      if (phoneTriggerRef.current?.contains(event.target)) return;
      if (insiderPopupRef.current?.contains(event.target)) return;
      if (insiderTriggerRef.current?.contains(event.target)) return;
      if (contactDetailsPopupRef.current?.contains(event.target)) return;
      setIsShareToMenuOpen(false);
      setIsShareEmoteOpen(false);
      setIsSharePanelOpen(false);
      setIsPresenceMenuOpen(false);
      setIsContactViewMenuOpen(false);
      setIsPhonePopupOpen(false);
      setIsInsiderPopupOpen(false);
      setIsContactDetailsOpen(false);
      setIsContactDetailsDragging(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [
    isSharePanelOpen,
    isShareToMenuOpen,
    isShareEmoteOpen,
    isPresenceMenuOpen,
    isContactViewMenuOpen,
    isPhonePopupOpen,
    isInsiderPopupOpen,
    isContactDetailsOpen,
  ]);

  useEffect(() => {
    if (!isSharePanelOpen) {
      setIsShareEmoteOpen(false);
    }
  }, [isSharePanelOpen]);

  const handleContactSelect = (contact) => {
    setRecentContacts((prev) =>
      prev.some((item) => item.id === contact.id) ? prev : [contact, ...prev]
    );
    onOpenConversation?.(contact);
  };

  const recentCount = displayedRecentContacts.length;
  const recentTotalCount = normalizedRecentContacts.length;
  const friendsCount = displayedFriends.length;
  const friendsTotalCount = normalizedFriends.length;

  return (
    <div className="yahoo-signedin">
      <div className="yahoo-signedin-profile">
        <img
          src={userAvatar}
          alt={`${username} avatar`}
          className="yahoo-signedin-avatar"
          draggable="false"
        />
        <div className="yahoo-signedin-user" ref={contactDetailsHostRef}>
          <div className="yahoo-signedin-name-row">
            <span
              className={`yahoo-signedin-status-dot${presence === "invisible" ? " is-invisible" : " is-online"}`}
              aria-hidden="true"
            />
            <div className="yahoo-signedin-name-menu-wrap">
              <button
                type="button"
                className="yahoo-signedin-name-trigger"
                aria-haspopup="menu"
                aria-expanded={isPresenceMenuOpen}
                ref={presenceTriggerRef}
                onClick={() => setIsPresenceMenuOpen((prev) => !prev)}
              >
                <span className="yahoo-signedin-name">{username}</span>
                <span className="yahoo-signedin-name-arrow" aria-hidden="true" />
              </button>
              {isPresenceMenuOpen ? (
                <div className="yahoo-signedin-presence-menu" role="menu" ref={presenceMenuRef}>
                  {PRESENCE_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      role="menuitemradio"
                      aria-checked={presence === option.value}
                      className={`yahoo-signedin-presence-option${presence === option.value ? " is-active" : ""}`}
                      onClick={() => handlePresenceSelect(option.value)}
                    >
                      <span
                        className={`yahoo-signedin-presence-indicator${option.value === "invisible" ? " is-invisible" : " is-online"}`}
                        aria-hidden="true"
                      />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <span className="yahoo-signedin-badge">
              <img
                src={yahooBadgeIcon}
                alt="Yahoo"
                className="yahoo-signedin-badge-icon"
                draggable="false"
              />
              <span
                className="yahoo-signedin-badge-text"
                role="button"
                tabIndex={0}
                ref={insiderTriggerRef}
                onClick={handleInsiderClick}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleInsiderClick();
                  }
                }}
              >
                Insider
              </span>
              {isInsiderPopupOpen ? (
                <div className="yahoo-signedin-insider-popup" role="dialog" ref={insiderPopupRef}>
                  <div className="yahoo-signedin-insider-popup-title">Yahoo! Insider</div>
                  <div className="yahoo-signedin-insider-popup-body">
                    Yahoo Insider is no longer available. Service updates and tips have ended.
                  </div>
                  <button
                    type="button"
                    className="yahoo-signedin-insider-popup-close"
                    onClick={() => setIsInsiderPopupOpen(false)}
                  >
                    OK
                  </button>
                </div>
              ) : null}
            </span>
          </div>
          {isContactDetailsOpen ? (
            <div
              className="yahoo-signedin-contact-details-popup"
              role="dialog"
              aria-label="My Contact Details"
              ref={contactDetailsPopupRef}
              style={{
                left: `${contactDetailsPosition.x}px`,
                top: `${contactDetailsPosition.y}px`,
              }}
            >
              <div
                className="yahoo-signedin-contact-details-header"
                onMouseDown={handleContactDetailsHeaderMouseDown}
              >
                <div className="yahoo-signedin-contact-details-title">My Contact Details</div>
                <button
                  type="button"
                  className="yahoo-signedin-contact-details-close"
                  aria-label="Close"
                  onClick={() => {
                    setIsContactDetailsOpen(false);
                    setIsContactDetailsDragging(false);
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <img src={closeIcon} alt="" aria-hidden="true" />
                </button>
              </div>
              <div className="yahoo-signedin-contact-details-body">
                <div className="yahoo-signedin-contact-details-grid">
                  <label className="yahoo-signedin-contact-details-field">
                    <span>Yahoo! ID:</span>
                    <input
                      type="text"
                      value={contactDetailsUsernameDraft}
                      onChange={(event) => setContactDetailsUsernameDraft(event.target.value)}
                    />
                  </label>
                  <label className="yahoo-signedin-contact-details-field">
                    <span>Network:</span>
                    <select defaultValue="yahoo-messenger">
                      <option value="yahoo-messenger">Yahoo! Messenger</option>
                    </select>
                  </label>
                  <label className="yahoo-signedin-contact-details-field">
                    <span>Status Message:</span>
                    <input
                      type="text"
                      value={contactDetailsStatusDraft}
                      onChange={(event) => setContactDetailsStatusDraft(event.target.value)}
                    />
                  </label>
                  <label className="yahoo-signedin-contact-details-field">
                    <span>Availability:</span>
                    <select
                      value={contactDetailsPresenceDraft}
                      onChange={(event) => setContactDetailsPresenceDraft(event.target.value)}
                    >
                      {PRESENCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="yahoo-signedin-contact-details-tip">
                  Update your profile details shown in Messenger.
                </div>
                <div className="yahoo-signedin-contact-details-actions">
                  <button
                    type="button"
                    className="yahoo-signedin-contact-details-btn is-primary"
                    onClick={handleSaveContactDetails}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="yahoo-signedin-contact-details-btn"
                    onClick={() => setIsContactDetailsOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {isSharePanelOpen ? (
            <div className="yahoo-signedin-share-panel" ref={sharePanelRef}>
              <div className="yahoo-signedin-share-inputs">
                <input
                  className="yahoo-signedin-status-input"
                  type="text"
                  value={statusText}
                  onChange={(event) => setStatusText(event.target.value)}
                />
                <div
                  className="yahoo-signedin-status-icon"
                  role="button"
                  aria-label="Share options"
                  tabIndex={0}
                  ref={statusButtonRef}
                  onClick={handleStatusIconClick}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleStatusIconClick();
                    }
                  }}
                />
                <input
                  className="yahoo-signedin-link-input"
                  type="text"
                  placeholder="also link to a web page..."
                  value={linkText}
                  onChange={(event) => setLinkText(event.target.value)}
                />
              </div>
              <div className="yahoo-signedin-share-row">
                <button
                  type="button"
                  className="yahoo-signedin-shareto"
                  ref={shareToButtonRef}
                  onClick={() => setIsShareToMenuOpen((prev) => !prev)}
                >
                  Share to
                  <span className="yahoo-signedin-shareto-arrow" aria-hidden="true" />
                </button>
                <div className="yahoo-signedin-share-smiley-wrap" ref={shareEmoteRef}>
                  <button
                    type="button"
                    className="yahoo-signedin-share-smiley"
                    aria-label="Emoticons"
                    onClick={() => setIsShareEmoteOpen((prev) => !prev)}
                  >
                    <img src={yahooShareIcon} alt="" draggable="false" aria-hidden="true" />
                  </button>
                  <YahooEmoticonMenu
                    isOpen={isShareEmoteOpen}
                    onSelect={handleShareEmoteSelect}
                    menuRef={shareEmoteMenuRef}
                    className="is-share"
                  />
                </div>
                <button type="button" className="yahoo-signedin-share-button">
                  Share
                </button>
                {isShareToMenuOpen ? (
                  <div className="yahoo-signedin-shareto-menu" ref={shareToMenuRef}>
                    {SHARE_TARGETS.map((target) => (
                      <label key={target.label} className="yahoo-signedin-shareto-item">
                        <input type="checkbox" defaultChecked />
                        <img
                          src={target.icon}
                          alt=""
                          className={`yahoo-signedin-shareto-icon ${target.iconClass || ""}`}
                          draggable="false"
                          aria-hidden="true"
                        />
                        <span>{target.label}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="yahoo-signedin-status-row">
              <input
                className="yahoo-signedin-status-input"
                type="text"
                value={statusText}
                onChange={(event) => setStatusText(event.target.value)}
              />
              <div
                className="yahoo-signedin-status-icon"
                role="button"
                aria-label="Share options"
                tabIndex={0}
                ref={statusButtonRef}
                onClick={handleStatusIconClick}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleStatusIconClick();
                  }
                }}
              />
            </div>
          )}
          <div className="yahoo-signedin-actions">
            <div className="yahoo-signedin-phone-wrap">
              <img
                src={phoneIcon}
                alt="Call"
                className="yahoo-signedin-action-icon is-phone"
                draggable="false"
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                aria-expanded={isPhonePopupOpen}
                ref={phoneTriggerRef}
                onClick={handlePhoneIconClick}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handlePhoneIconClick();
                  }
                }}
              />
              {isPhonePopupOpen ? (
                <div className="yahoo-signedin-phone-popup" role="dialog" ref={phonePopupRef}>
                  <div className="yahoo-signedin-phone-popup-title">Yahoo! Messenger Call</div>
                  <div className="yahoo-signedin-phone-popup-body">
                    {noIncomingCalls
                      ? "Incoming calls are turned off."
                      : "Phone calls are unavailable right now."}
                  </div>
                  <button
                    type="button"
                    className="yahoo-signedin-phone-popup-close"
                    onClick={() => setIsPhonePopupOpen(false)}
                  >
                    OK
                  </button>
                </div>
              ) : null}
            </div>
            <div className="yahoo-signedin-action-group">
              <img
                src={diceIcon}
                alt="Games"
                className="yahoo-signedin-action-icon is-dice"
                draggable="false"
                role="button"
                tabIndex={0}
                onClick={handleOpenGamesPortal}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleOpenGamesPortal();
                  }
                }}
              />
              <span
                className="yahoo-signedin-action"
                role="button"
                tabIndex={0}
                onClick={handleOpenGamesPortal}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleOpenGamesPortal();
                  }
                }}
              >
                Games
              </span>
            </div>
          <img
            src={emailIcon}
            alt="Mail"
            className="yahoo-signedin-action-icon is-email"
            draggable="false"
            role="button"
            tabIndex={0}
            onClick={handleOpenMailInbox}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleOpenMailInbox();
              }
            }}
          />
          </div>
        </div>
      </div>

      <div className="yahoo-signedin-tabs">
        <button
          type="button"
          className={`yahoo-signedin-tab${activeTab === "contacts" ? " is-active" : ""}`}
          onClick={() => handleTabSelect("contacts")}
        >
          Contacts
        </button>
        <button type="button" className="yahoo-signedin-tab-divider" aria-label="Contacts menu">
          <span className="yahoo-signedin-tab-arrow" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`yahoo-signedin-tab${activeTab === "updates" ? " is-active" : ""}`}
          onClick={() => handleTabSelect("updates")}
        >
          Y! Updates
        </button>
      </div>

      <div className="yahoo-signedin-toolbar">
        <img
          src={isAddFriendHovered ? addFriendHoveredIcon : addFriendIcon}
          alt="Add friend"
          className="yahoo-signedin-tool-icon is-add"
          draggable="false"
          onClick={() => onAddContact?.()}
          onMouseEnter={() => setIsAddFriendHovered(true)}
          onMouseLeave={() => setIsAddFriendHovered(false)}
          role="button"
          tabIndex={0}
        />
        <div className="yahoo-signedin-contactview-wrap">
          <img
            src={contactViewIcon}
            alt="Contact view"
            className={`yahoo-signedin-tool-icon is-contact${activeTab !== "contacts" ? " is-disabled" : ""}`}
            draggable="false"
            role="button"
            tabIndex={0}
            aria-haspopup="menu"
            aria-expanded={isContactViewMenuOpen}
            ref={contactViewButtonRef}
            onClick={handleContactViewToggle}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleContactViewToggle();
              }
            }}
          />
          {isContactViewMenuOpen ? (
            <div className="yahoo-signedin-contactview-menu" role="menu" ref={contactViewMenuRef}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={contactViewMode === "detailed"}
                className={`yahoo-signedin-contactview-item${contactViewMode === "detailed" ? " is-active" : ""}`}
                onClick={() => handleContactViewModeSelect("detailed")}
              >
                <span className="yahoo-signedin-contactview-mark" aria-hidden="true">
                  {contactViewMode === "detailed" ? "•" : ""}
                </span>
                <span>Detailed View</span>
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={contactViewMode === "compact"}
                className={`yahoo-signedin-contactview-item${contactViewMode === "compact" ? " is-active" : ""}`}
                onClick={() => handleContactViewModeSelect("compact")}
              >
                <span className="yahoo-signedin-contactview-mark" aria-hidden="true">
                  {contactViewMode === "compact" ? "•" : ""}
                </span>
                <span>Compact View</span>
              </button>
              <div className="yahoo-signedin-contactview-separator" />
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={showRecentContacts}
                className="yahoo-signedin-contactview-item"
                onClick={handleToggleShowRecentContacts}
              >
                <span className="yahoo-signedin-contactview-mark" aria-hidden="true">
                  {showRecentContacts ? "✓" : ""}
                </span>
                <span>Show Recent Contacts</span>
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={showOfflineContacts}
                className="yahoo-signedin-contactview-item"
                onClick={handleToggleShowOfflineContacts}
              >
                <span className="yahoo-signedin-contactview-mark" aria-hidden="true">
                  {showOfflineContacts ? "✓" : ""}
                </span>
                <span>Show Offline Contacts</span>
              </button>
              <div className="yahoo-signedin-contactview-separator" />
              <button
                type="button"
                role="menuitemradio"
                aria-checked={sortBy === "status"}
                className={`yahoo-signedin-contactview-item${sortBy === "status" ? " is-active" : ""}`}
                onClick={() => handleSortBySelect("status")}
              >
                <span className="yahoo-signedin-contactview-mark" aria-hidden="true">
                  {sortBy === "status" ? "•" : ""}
                </span>
                <span>Sort by Status</span>
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={sortBy === "name"}
                className={`yahoo-signedin-contactview-item${sortBy === "name" ? " is-active" : ""}`}
                onClick={() => handleSortBySelect("name")}
              >
                <span className="yahoo-signedin-contactview-mark" aria-hidden="true">
                  {sortBy === "name" ? "•" : ""}
                </span>
                <span>Sort by Name</span>
              </button>
            </div>
          ) : null}
        </div>
        <div className="yahoo-signedin-search">
          <img
            src={searchIcon}
            alt="Search"
            className="yahoo-signedin-search-icon"
            draggable="false"
          />
          <input
            type="text"
            placeholder="type some contact information..."
            aria-label="Search contacts"
            value={contactSearch}
            onChange={(event) => setContactSearch(event.target.value)}
          />
        </div>
      </div>

      <div className={`yahoo-signedin-list${contactViewMode === "compact" ? " is-compact" : ""}`}>
        {activeTab === "contacts" ? (
          <>
            {showRecentContacts ? (
              <>
                <div
                  className={`yahoo-signedin-group${collapsedGroups.recent ? " is-collapsed" : ""}`}
                  onClick={() =>
                    setCollapsedGroups((prev) => ({ ...prev, recent: !prev.recent }))
                  }
                >
                  <img
                    src={collapsedGroups.recent ? rightArrowIcon : downArrowIcon}
                    alt=""
                    className="yahoo-signedin-group-toggle"
                    draggable="false"
                    aria-hidden="true"
                  />
                  <img
                    src={yahooWatchIcon}
                    alt="Recent contacts"
                    className="yahoo-signedin-group-icon"
                    draggable="false"
                  />
                  <span className="yahoo-signedin-group-title">
                    {`Recent Contacts (${recentCount}/${recentTotalCount})`}
                  </span>
                </div>
                {!collapsedGroups.recent
                  ? displayedRecentContacts.map((contact) => (
                      <div
                        key={`recent-${contact.id}`}
                        className={`yahoo-signedin-contact${contact.isFriend ? " friends" : ""}`}
                        onClick={() => handleContactSelect(contact)}
                      >
                        <img
                          src={contact.icon}
                          alt={contact.name}
                          className="yahoo-signedin-contact-avatar"
                          draggable="false"
                        />
                        <span
                          className={`yahoo-signedin-contact-status${contact.status === "offline" ? " is-offline" : " is-online"}`}
                        />
                        <span className="yahoo-signedin-contact-name">{contact.name}</span>
                      </div>
                    ))
                  : null}
              </>
            ) : null}
            <div
              className={`yahoo-signedin-group${collapsedGroups.friends ? " is-collapsed" : ""}`}
              onClick={() =>
                setCollapsedGroups((prev) => ({ ...prev, friends: !prev.friends }))
              }
            >
              <img
                src={collapsedGroups.friends ? rightArrowIcon : downArrowIcon}
                alt=""
                className="yahoo-signedin-group-toggle"
                draggable="false"
                aria-hidden="true"
              />
              <span className="yahoo-signedin-group-title">
                {`Friends (${friendsCount}/${friendsTotalCount})`}
              </span>
            </div>
            {!collapsedGroups.friends
              ? displayedFriends.map((contact) => (
                  <div
                    key={contact.id}
                    className={`yahoo-signedin-contact${contact.isFriend ? " friends" : ""}`}
                    onClick={() => handleContactSelect(contact)}
                  >
                    <img
                      src={contact.icon}
                      alt={contact.name}
                      className="yahoo-signedin-contact-avatar"
                      draggable="false"
                    />
                    <span
                      className={`yahoo-signedin-contact-status${contact.status === "offline" ? " is-offline" : " is-online"}`}
                    />
                    <span className="yahoo-signedin-contact-name">{contact.name}</span>
                  </div>
                ))
              : null}
            <div
              className={`yahoo-signedin-group${collapsedGroups.addressBook ? " is-collapsed" : ""}`}
              onClick={() =>
                setCollapsedGroups((prev) => ({ ...prev, addressBook: !prev.addressBook }))
              }
            >
              <img
                src={collapsedGroups.addressBook ? rightArrowIcon : downArrowIcon}
                alt=""
                className="yahoo-signedin-group-toggle"
                draggable="false"
                aria-hidden="true"
              />
              <span className="yahoo-signedin-group-title">Address Book (0)</span>
            </div>
          </>
        ) : displayedUpdates.length ? (
          displayedUpdates.map((update) => {
            const isClickable = Boolean(update.contact);
            return (
              <div
                key={update.id}
                className={`yahoo-signedin-update${isClickable ? " is-clickable" : ""}`}
                onClick={isClickable ? () => handleContactSelect(update.contact) : undefined}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={
                  isClickable
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleContactSelect(update.contact);
                        }
                      }
                    : undefined
                }
              >
                <img
                  src={update.icon}
                  alt={update.name}
                  className="yahoo-signedin-contact-avatar"
                  draggable="false"
                />
                <span
                  className={`yahoo-signedin-contact-status${update.status === "offline" ? " is-offline" : " is-online"}`}
                />
                <div className="yahoo-signedin-update-copy">
                  <div className="yahoo-signedin-update-text">
                    <strong>{update.name}</strong> {update.text}
                  </div>
                  <div className="yahoo-signedin-update-time">{update.time}</div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="yahoo-signedin-updates-empty">No new updates.</div>
        )}
      </div>

      <div className="yahoo-signedin-footer">
        <span>Plug-ins</span>
        <span>Add Plug-ins</span>
      </div>
    </div>
  );
};

export default YahooSignedIn;
