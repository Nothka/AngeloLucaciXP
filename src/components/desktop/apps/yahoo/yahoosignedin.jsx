import React, { useEffect, useRef, useState } from "react";
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
import YahooEmoticonMenu from "./emoticonmenu";
import "../../../../styles/desktop/apps/yahoo/yahoosignedin.css";

const DEFAULT_STATUS = "This is a drill";
const SHARE_TARGETS = [
  { label: "Yahoo! Messenger", icon: yahooShareIcon, iconClass: "is-yahoo" },
  { label: "Yahoo! Updates", icon: yahooUpdatesIcon, iconClass: "is-yahoo-updates" },
  { label: "Facebook", icon: facebookIcon },
  { label: "Twitter", icon: twitterIcon },
];
export const DEFAULT_FRIEND_CONTACTS = [
  { id: "chatgpt", name: "ChatGPT", icon: chatgptIcon, isFriend: true },
  { id: "gemini", name: "Gemini", icon: geminiIcon, isFriend: true },
];

const YahooSignedIn = ({
  username = "angelo_lucaci",
  onOpenConversation,
  onAddContact,
  friends = DEFAULT_FRIEND_CONTACTS,
}) => {
  const [statusText, setStatusText] = useState(DEFAULT_STATUS);
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const [isShareToMenuOpen, setIsShareToMenuOpen] = useState(false);
  const [isShareEmoteOpen, setIsShareEmoteOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [isAddFriendHovered, setIsAddFriendHovered] = useState(false);
  const [recentContacts, setRecentContacts] = useState([]);
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

  const handleStatusIconClick = () => {
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

  useEffect(() => {
    if (!isSharePanelOpen && !isShareToMenuOpen) return;
    const handleOutsideClick = (event) => {
      if (sharePanelRef.current?.contains(event.target)) return;
      if (statusButtonRef.current?.contains(event.target)) return;
      if (shareToMenuRef.current?.contains(event.target)) return;
      if (shareToButtonRef.current?.contains(event.target)) return;
      if (shareEmoteMenuRef.current?.contains(event.target)) return;
      if (shareEmoteRef.current?.contains(event.target)) return;
      setIsShareToMenuOpen(false);
      setIsShareEmoteOpen(false);
      setIsSharePanelOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isSharePanelOpen, isShareToMenuOpen]);

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

  const recentCount = recentContacts.length;
  const friendsCount = friends.length;

  return (
    <div className="yahoo-signedin">
      <div className="yahoo-signedin-profile">
        <img
          src={userAvatar}
          alt={`${username} avatar`}
          className="yahoo-signedin-avatar"
          draggable="false"
        />
        <div className="yahoo-signedin-user">
          <div className="yahoo-signedin-name-row">
            <span className="yahoo-signedin-status-dot" />
            <span className="yahoo-signedin-name">{username}</span>
            <span className="yahoo-signedin-name-arrow" aria-hidden="true" />
            <span className="yahoo-signedin-badge">
              <img
                src={yahooBadgeIcon}
                alt="Yahoo"
                className="yahoo-signedin-badge-icon"
                draggable="false"
              />
              <span className="yahoo-signedin-badge-text">Insider</span>
            </span>
          </div>
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
            <img
              src={phoneIcon}
              alt="Call"
              className="yahoo-signedin-action-icon is-phone"
              draggable="false"
            />
            <div className="yahoo-signedin-action-group">
              <img
                src={diceIcon}
                alt="Games"
                className="yahoo-signedin-action-icon is-dice"
                draggable="false"
              />
              <span className="yahoo-signedin-action">Games</span>
            </div>
          <img
            src={emailIcon}
            alt="Mail"
            className="yahoo-signedin-action-icon is-email"
            draggable="false"
          />
          </div>
        </div>
      </div>

      <div className="yahoo-signedin-tabs">
        <button type="button" className="yahoo-signedin-tab is-active">
          Contacts
        </button>
        <button type="button" className="yahoo-signedin-tab-divider" aria-label="Contacts menu">
          <span className="yahoo-signedin-tab-arrow" aria-hidden="true" />
        </button>
        <button type="button" className="yahoo-signedin-tab">
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
        <img
          src={contactViewIcon}
          alt="Contact view"
          className="yahoo-signedin-tool-icon is-contact"
          draggable="false"
        />
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
            readOnly
          />
        </div>
      </div>

      <div className="yahoo-signedin-list">
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
            {`Recent Contacts (${recentCount}/${recentCount})`}
          </span>
        </div>
        {!collapsedGroups.recent
          ? recentContacts.map((contact) => (
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
                <span className="yahoo-signedin-contact-status" />
                <span className="yahoo-signedin-contact-name">{contact.name}</span>
              </div>
            ))
          : null}
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
            {`Friends (${friendsCount}/${friendsCount})`}
          </span>
        </div>
        {!collapsedGroups.friends
          ? friends.map((contact) => (
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
                <span className="yahoo-signedin-contact-status" />
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
      </div>

      <div className="yahoo-signedin-footer">
        <span>Plug-ins</span>
        <span>Add Plug-ins</span>
      </div>
    </div>
  );
};

export default YahooSignedIn;
