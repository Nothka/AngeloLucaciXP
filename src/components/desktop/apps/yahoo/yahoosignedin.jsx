import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import defaultUserAvatar from "../../../../assets/yahoo/soccer.webp";
import snowmanAvatar from "../../../../assets/yahoo/snowman.webp";
import chatgptIcon from "../../../../assets/yahoo/chatgpt.jpg";
import geminiIcon from "../../../../assets/icons/skills/gemini.webp";
import diceIcon from "../../../../assets/yahoo/dice.webp";
import emailIcon from "../../../../assets/yahoo/fastemail.webp";
import addFriendIcon from "../../../../assets/yahoo/addfriend.webp";
import addFriendHoveredIcon from "../../../../assets/yahoo/addfriendhovered.webp";
import contactViewIcon from "../../../../assets/yahoo/contactview.webp";
import phoneIcon from "../../../../assets/yahoo/phone.webp";
import searchIcon from "../../../../assets/yahoo/search.webp";
import facebookIcon from "../../../../assets/yahoo/facebook.webp";
import twitterIcon from "../../../../assets/yahoo/twitter.webp";
import yahooUpdatesIcon from "../../../../assets/yahoo/yahooapp.webp";
import yahooShareIcon from "../../../../assets/yahoo/yahooicon.webp";
import yahooBadgeIcon from "../../../../assets/yahoo/Yahoo-icon.webp";
import yahooWatchIcon from "../../../../assets/yahoo/yahoowatch.webp";
import downArrowIcon from "../../../../assets/yahoo/down-arrow.webp";
import rightArrowIcon from "../../../../assets/yahoo/right-arrow.webp";
import classicAvatarOne from "../../../../assets/yahoo/yahoo-window/Untitled design (20).webp";
import classicAvatarTwo from "../../../../assets/yahoo/yahoo-window/Untitled design (21).webp";
import classicAvatarThree from "../../../../assets/yahoo/yahoo-window/Untitled design (22).webp";
import classicAvatarFour from "../../../../assets/yahoo/yahoo-window/Untitled design (27).webp";
import YahooEmoticonMenu from "./emoticonmenu";
import YahooAccountInfoPopup from "./yahoo-signedin-popups/yahoo-account-info-popup";
import YahooContactDetailsPopup from "./yahoo-signedin-popups/yahoo-contact-details-popup";
import YahooDisplayImagePopup from "./yahoo-signedin-popups/yahoo-display-image-popup";
import YahooManageUpdatesPopup from "./yahoo-signedin-popups/yahoo-manage-updates-popup";
import YahooWebcamPopup from "./yahoo-signedin-popups/yahoo-webcam-popup";
import YahooAddressBookPopup from "./yahoo-signedin-popups/yahoo-address-book-popup";
import YahooImportContactsPopup from "./yahoo-signedin-popups/yahoo-import-contacts-popup";
import YahooManageGroupsPopup from "./yahoo-signedin-popups/yahoo-manage-groups-popup";
import YahooSelectedContactDetailsPopup from "./yahoo-signedin-popups/yahoo-selected-contact-details-popup";
import YahooConversationHistoryPopup from "./yahoo-signedin-popups/yahoo-conversation-history-popup";
import "../../../../styles/desktop/apps/yahoo/yahoosignedin.css";

const DEFAULT_STATUS = "This is a drill";
const YAHOO_MAIL_URL = "https://mail.yahoo.com";
const GAMES_PORTAL_URL = "https://www.crazygames.com/";
const YAHOO_ACCOUNT_INFO_URL = "https://login.yahoo.com/account";
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
const DISPLAY_IMAGE_OPTIONS = [
  { id: "soccer", label: "Soccer", src: defaultUserAvatar },
  { id: "snowman", label: "Snowman", src: snowmanAvatar },
  { id: "classic-1", label: "Classic 1", src: classicAvatarOne },
  { id: "classic-2", label: "Classic 2", src: classicAvatarTwo },
  { id: "classic-3", label: "Classic 3", src: classicAvatarThree },
  { id: "classic-4", label: "Classic 4", src: classicAvatarFour },
];
const ADDRESS_BOOK_CONTACTS = [
  { id: "ab-jamie", name: "Jamie Parker", email: "jamie.parker@yahoo.com" },
  { id: "ab-nora", name: "Nora Miles", email: "nora.miles@gmail.com" },
  { id: "ab-victor", name: "Victor Lane", email: "victor.lane@hotmail.com" },
  { id: "ab-kim", name: "Kim Flores", email: "kim.flores@ymail.com" },
];
const IMPORT_CONTACT_SOURCE_OPTIONS = [
  { value: "gmail", label: "Gmail" },
  { value: "yahoo", label: "Yahoo Address Book" },
  { value: "csv", label: "CSV File" },
];
const IMPORT_CONTACTS_BY_SOURCE = {
  gmail: [
    { id: "gmail-1", name: "Liam Carter", email: "liam.carter@gmail.com" },
    { id: "gmail-2", name: "Ava Reed", email: "ava.reed@gmail.com" },
    { id: "gmail-3", name: "Noah Hill", email: "noah.hill@gmail.com" },
  ],
  yahoo: [
    { id: "yahoo-1", name: "Mia Torres", email: "mia.torres@yahoo.com" },
    { id: "yahoo-2", name: "Ethan Ross", email: "ethan.ross@yahoo.com" },
  ],
  csv: [
    { id: "csv-1", name: "Olivia Knox", email: "olivia.knox@example.com" },
    { id: "csv-2", name: "Lucas Dean", email: "lucas.dean@example.com" },
  ],
};
const DEFAULT_MANAGE_GROUPS = ["Friends"];
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
  openContactProfileRequestId = 0,
  openAccountInfoRequestId = 0,
  openDisplayImageRequestId = 0,
  openWebcamRequestId = 0,
  openManageUpdatesRequestId = 0,
  openConversationHistoryRequestId = 0,
  openAddressBookContactRequestId = 0,
  openImportContactsRequestId = 0,
  openManageGroupsRequestId = 0,
  avatarSrc = defaultUserAvatar,
  onContactDetailsSave,
  onDisplayImageSave,
  onAddAddressBookContact,
  onImportContacts,
  onClearConversationHistory,
  conversationHistoryConversations = [],
  contactGroups = DEFAULT_MANAGE_GROUPS,
  onContactGroupsChange,
  selectedContactId = "",
  selectedContact = null,
  stealthByContact = {},
  onContactFocus,
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
  const [isAccountInfoOpen, setIsAccountInfoOpen] = useState(false);
  const [isDisplayImageOpen, setIsDisplayImageOpen] = useState(false);
  const [displayImageDraft, setDisplayImageDraft] = useState(defaultUserAvatar);
  const [isWebcamPopupOpen, setIsWebcamPopupOpen] = useState(false);
  const [isManageUpdatesOpen, setIsManageUpdatesOpen] = useState(false);
  const [isAddressBookPopupOpen, setIsAddressBookPopupOpen] = useState(false);
  const [addressBookSearch, setAddressBookSearch] = useState("");
  const [selectedAddressBookId, setSelectedAddressBookId] = useState("");
  const [isImportContactsPopupOpen, setIsImportContactsPopupOpen] = useState(false);
  const [importSource, setImportSource] = useState("gmail");
  const [selectedImportContactIds, setSelectedImportContactIds] = useState([]);
  const [importStatusText, setImportStatusText] = useState("");
  const [isImportingContacts, setIsImportingContacts] = useState(false);
  const [isManageGroupsPopupOpen, setIsManageGroupsPopupOpen] = useState(false);
  const [isSelectedContactDetailsOpen, setIsSelectedContactDetailsOpen] = useState(false);
  const [isConversationHistoryOpen, setIsConversationHistoryOpen] = useState(false);
  const [conversationHistorySearch, setConversationHistorySearch] = useState("");
  const [conversationHistoryStatusText, setConversationHistoryStatusText] = useState("");
  const [manageGroups, setManageGroups] = useState(() => {
    if (!Array.isArray(contactGroups) || !contactGroups.length) {
      return [...DEFAULT_MANAGE_GROUPS];
    }
    const normalizedDefault = DEFAULT_MANAGE_GROUPS[0].trim().toLowerCase();
    const unique = [];
    const seen = new Set();
    contactGroups.forEach((groupName) => {
      const trimmed = String(groupName || "").trim();
      if (!trimmed) return;
      const normalized = trimmed.toLowerCase();
      if (seen.has(normalized)) return;
      seen.add(normalized);
      unique.push(trimmed);
    });
    if (!seen.has(normalizedDefault)) {
      unique.unshift(DEFAULT_MANAGE_GROUPS[0]);
      seen.add(normalizedDefault);
    }
    return unique.length ? unique : [...DEFAULT_MANAGE_GROUPS];
  });
  const [selectedManageGroup, setSelectedManageGroup] = useState(
    () => manageGroups[0] || DEFAULT_MANAGE_GROUPS[0]
  );
  const [manageGroupDraft, setManageGroupDraft] = useState(
    () => manageGroups[0] || DEFAULT_MANAGE_GROUPS[0]
  );
  const [manageGroupsStatusText, setManageGroupsStatusText] = useState("");
  const [updatesAudience, setUpdatesAudience] = useState("connections");
  const [broadcastStatus, setBroadcastStatus] = useState(true);
  const [broadcastDisplayImage, setBroadcastDisplayImage] = useState(true);
  const [broadcastSocial, setBroadcastSocial] = useState(true);
  const [updatesAudienceDraft, setUpdatesAudienceDraft] = useState("connections");
  const [broadcastStatusDraft, setBroadcastStatusDraft] = useState(true);
  const [broadcastDisplayImageDraft, setBroadcastDisplayImageDraft] = useState(true);
  const [broadcastSocialDraft, setBroadcastSocialDraft] = useState(true);
  const [webcamState, setWebcamState] = useState("idle");
  const [webcamError, setWebcamError] = useState("");
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
  const [collapsedCustomGroups, setCollapsedCustomGroups] = useState({});
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
  const accountInfoPopupRef = useRef(null);
  const displayImagePopupRef = useRef(null);
  const manageUpdatesPopupRef = useRef(null);
  const addressBookPopupRef = useRef(null);
  const importContactsPopupRef = useRef(null);
  const manageGroupsPopupRef = useRef(null);
  const selectedContactDetailsPopupRef = useRef(null);
  const conversationHistoryPopupRef = useRef(null);
  const webcamPopupRef = useRef(null);
  const webcamVideoRef = useRef(null);
  const webcamStreamRef = useRef(null);
  const webcamRequestRef = useRef(0);
  const importContactsTimeoutRef = useRef(null);
  const selectedManageGroupRef = useRef(DEFAULT_MANAGE_GROUPS[0]);
  const conversationHistoryRequestHandledRef = useRef(0);
  const isWebcamPopupOpenRef = useRef(false);
  const contactDetailsHostRef = useRef(null);
  const contactDetailsDragOffsetRef = useRef({ x: 0, y: 0 });
  const presence = controlledPresence ?? uncontrolledPresence;
  const resolvedAvatarSrc = avatarSrc || defaultUserAvatar;

  useEffect(() => {
    selectedManageGroupRef.current = selectedManageGroup || DEFAULT_MANAGE_GROUPS[0];
  }, [selectedManageGroup]);

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
  const defaultGroupKey = DEFAULT_MANAGE_GROUPS[0].toLowerCase();
  const normalizeGroupName = useCallback(
    (groupName = "") => String(groupName).trim().toLowerCase(),
    []
  );
  const sanitizeGroupList = useCallback(
    (groups = []) => {
      const normalizedDefault = normalizeGroupName(DEFAULT_MANAGE_GROUPS[0]);
      const unique = [];
      const seen = new Set();
      groups.forEach((groupName) => {
        const trimmed = String(groupName || "").trim();
        if (!trimmed) return;
        const normalized = normalizeGroupName(trimmed);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        unique.push(trimmed);
      });
      if (!seen.has(normalizedDefault)) {
        unique.unshift(DEFAULT_MANAGE_GROUPS[0]);
      }
      return unique.length ? unique : [...DEFAULT_MANAGE_GROUPS];
    },
    [normalizeGroupName]
  );
  const areGroupListsEqual = useCallback(
    (left = [], right = []) => {
      const nextLeft = sanitizeGroupList(left);
      const nextRight = sanitizeGroupList(right);
      if (nextLeft.length !== nextRight.length) return false;
      return nextLeft.every(
        (groupName, index) =>
          normalizeGroupName(groupName) === normalizeGroupName(nextRight[index])
      );
    },
    [normalizeGroupName, sanitizeGroupList]
  );
  useEffect(() => {
    const nextGroups = sanitizeGroupList(contactGroups);
    setManageGroups((prev) => (areGroupListsEqual(prev, nextGroups) ? prev : nextGroups));
  }, [areGroupListsEqual, contactGroups, sanitizeGroupList]);
  useEffect(() => {
    if (typeof onContactGroupsChange !== "function") return;
    const nextGroups = sanitizeGroupList(manageGroups);
    if (areGroupListsEqual(contactGroups, nextGroups)) return;
    onContactGroupsChange(nextGroups);
  }, [
    areGroupListsEqual,
    contactGroups,
    manageGroups,
    onContactGroupsChange,
    sanitizeGroupList,
  ]);
  const managedGroupKeys = useMemo(
    () => new Set(manageGroups.map((groupName) => normalizeGroupName(groupName)).filter(Boolean)),
    [manageGroups, normalizeGroupName]
  );
  const customGroupNames = useMemo(
    () =>
      manageGroups.filter((groupName) => normalizeGroupName(groupName) !== defaultGroupKey),
    [defaultGroupKey, manageGroups, normalizeGroupName]
  );
  const resolveContactGroupKey = useCallback(
    (contact) => {
      const nextKey = normalizeGroupName(contact?.group || DEFAULT_MANAGE_GROUPS[0]);
      return nextKey || defaultGroupKey;
    },
    [defaultGroupKey, normalizeGroupName]
  );
  const friendsBaseContacts = useMemo(
    () =>
      normalizedFriends.filter((contact) => {
        const groupKey = resolveContactGroupKey(contact);
        if (groupKey === defaultGroupKey) return true;
        return !managedGroupKeys.has(groupKey);
      }),
    [defaultGroupKey, managedGroupKeys, normalizedFriends, resolveContactGroupKey]
  );

  const displayedFriends = useMemo(() => {
    const visibleByStatus = showOfflineContacts
      ? friendsBaseContacts
      : friendsBaseContacts.filter((contact) => contact.status !== "offline");
    const visibleBySearch = normalizedContactSearch
      ? visibleByStatus.filter((contact) =>
          contact.name.toLowerCase().includes(normalizedContactSearch)
        )
      : visibleByStatus;
    return sortContacts(visibleBySearch);
  }, [friendsBaseContacts, normalizedContactSearch, showOfflineContacts, sortBy]);

  const customGroupSections = useMemo(
    () =>
      customGroupNames.map((groupName) => {
        const groupKey = normalizeGroupName(groupName);
        const groupContacts = normalizedFriends.filter(
          (contact) => resolveContactGroupKey(contact) === groupKey
        );
        const visibleByStatus = showOfflineContacts
          ? groupContacts
          : groupContacts.filter((contact) => contact.status !== "offline");
        const visibleBySearch = normalizedContactSearch
          ? visibleByStatus.filter((contact) =>
              contact.name.toLowerCase().includes(normalizedContactSearch)
            )
          : visibleByStatus;
        const visibleContacts = sortContacts(visibleBySearch);
        return {
          key: groupKey,
          name: groupName,
          totalCount: groupContacts.length,
          visibleCount: visibleContacts.length,
          visibleContacts,
        };
      }),
    [
      customGroupNames,
      normalizedContactSearch,
      normalizedFriends,
      resolveContactGroupKey,
      showOfflineContacts,
      sortBy,
    ]
  );

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
        icon: resolvedAvatarSrc,
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
  }, [normalizedFriends, normalizedRecentContacts, presence, resolvedAvatarSrc, statusText, username]);

  const displayedUpdates = useMemo(() => {
    if (!normalizedContactSearch) return updatesFeed;
    return updatesFeed.filter((update) =>
      `${update.name} ${update.text}`.toLowerCase().includes(normalizedContactSearch)
    );
  }, [normalizedContactSearch, updatesFeed]);
  const importSourceContacts = useMemo(
    () => IMPORT_CONTACTS_BY_SOURCE[importSource] || [],
    [importSource]
  );
  const filteredAddressBookContacts = useMemo(() => {
    const query = addressBookSearch.trim().toLowerCase();
    if (!query) return ADDRESS_BOOK_CONTACTS;
    return ADDRESS_BOOK_CONTACTS.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) || contact.email.toLowerCase().includes(query)
    );
  }, [addressBookSearch]);
  const manageGroupRows = useMemo(() => {
    return manageGroups.map((groupName) => {
      const groupKey = normalizeGroupName(groupName);
      const count =
        groupKey === defaultGroupKey
          ? friendsBaseContacts.length
          : normalizedFriends.filter((contact) => resolveContactGroupKey(contact) === groupKey)
              .length;
      return { name: groupName, count };
    });
  }, [defaultGroupKey, friendsBaseContacts.length, manageGroups, normalizedFriends, resolveContactGroupKey]);
  const isSelectedManageGroupProtected =
    normalizeGroupName(selectedManageGroup) === defaultGroupKey;
  const selectedContactResolved = useMemo(() => {
    if (selectedContact?.id) return selectedContact;
    if (!selectedContactId) return null;
    return friends.find((contact) => contact.id === selectedContactId) || null;
  }, [friends, selectedContact, selectedContactId]);
  const selectedConversationHistoryMessages = useMemo(() => {
    if (!selectedContactResolved?.name) return [];
    const targetName = selectedContactResolved.name.trim().toLowerCase();
    if (!targetName) return [];
    const entries = Array.isArray(conversationHistoryConversations)
      ? conversationHistoryConversations
      : [];
    return entries
      .filter((conversation) => {
        const conversationName = String(conversation?.contactName || "")
          .trim()
          .toLowerCase();
        return conversationName === targetName;
      })
      .flatMap((conversation) => {
        const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
        return messages.map((message, index) => {
          const sender = String(message?.sender || "").toLowerCase() === "contact"
            ? selectedContactResolved.name
            : "You";
          const text = String(message?.text || "").trim();
          return {
            id: message?.id || `${conversation?.id || "conversation"}-${index}`,
            sender,
            text,
            createdAt:
              typeof message?.createdAt === "number" && Number.isFinite(message.createdAt)
                ? message.createdAt
                : null,
          };
        });
      });
  }, [conversationHistoryConversations, selectedContactResolved]);
  const filteredConversationHistoryMessages = useMemo(() => {
    const query = conversationHistorySearch.trim().toLowerCase();
    if (!query) return selectedConversationHistoryMessages;
    return selectedConversationHistoryMessages.filter((message) =>
      `${message.sender} ${message.text}`.toLowerCase().includes(query)
    );
  }, [conversationHistorySearch, selectedConversationHistoryMessages]);

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

  const handleOpenAccountInfoPage = () => {
    if (typeof window === "undefined") return;
    window.open(YAHOO_ACCOUNT_INFO_URL, "_blank", "noopener,noreferrer");
  };

  const stopWebcamPreview = useCallback(() => {
    const stream = webcamStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      webcamStreamRef.current = null;
    }
    const videoElement = webcamVideoRef.current;
    if (videoElement) {
      videoElement.srcObject = null;
    }
    setWebcamState("idle");
    setWebcamError("");
  }, []);

  const startWebcamPreview = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setWebcamState("error");
      setWebcamError("Webcam is unavailable in this browser.");
      return;
    }

    webcamRequestRef.current += 1;
    const requestId = webcamRequestRef.current;

    const previousStream = webcamStreamRef.current;
    if (previousStream) {
      previousStream.getTracks().forEach((track) => track.stop());
      webcamStreamRef.current = null;
    }

    setWebcamState("requesting");
    setWebcamError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (requestId !== webcamRequestRef.current || !isWebcamPopupOpenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      webcamStreamRef.current = stream;
      const videoElement = webcamVideoRef.current;
      if (videoElement) {
        videoElement.srcObject = stream;
        await videoElement.play().catch(() => {});
      }
      setWebcamState("live");
    } catch (error) {
      if (requestId !== webcamRequestRef.current) return;
      const errorName = String(error?.name || "");
      if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
        setWebcamError("Camera permission was denied.");
      } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
        setWebcamError("No webcam was detected on this device.");
      } else {
        setWebcamError("Webcam is unavailable on this device/browser.");
      }
      setWebcamState("error");
    }
  }, []);

  const handlePhoneIconClick = () => {
    setIsPhonePopupOpen((prev) => !prev);
  };

  const handleInsiderClick = () => {
    setIsInsiderPopupOpen((prev) => !prev);
  };

  const handleSaveDisplayImage = () => {
    const nextAvatar = displayImageDraft || resolvedAvatarSrc;
    onDisplayImageSave?.(nextAvatar);
    setIsDisplayImageOpen(false);
  };

  const handleAddAddressBookContact = useCallback(() => {
    const selectedContact = filteredAddressBookContacts.find(
      (contact) => contact.id === selectedAddressBookId
    );
    if (!selectedContact) return;
    onAddAddressBookContact?.(selectedContact.name);
    setIsAddressBookPopupOpen(false);
  }, [filteredAddressBookContacts, onAddAddressBookContact, selectedAddressBookId]);

  const closeImportContactsPopup = useCallback(() => {
    if (importContactsTimeoutRef.current) {
      clearTimeout(importContactsTimeoutRef.current);
      importContactsTimeoutRef.current = null;
    }
    setIsImportingContacts(false);
    setSelectedImportContactIds([]);
    setImportStatusText("");
    setIsImportContactsPopupOpen(false);
  }, []);

  const handleImportContacts = useCallback(() => {
    const selectedContacts = importSourceContacts.filter((contact) =>
      selectedImportContactIds.includes(contact.id)
    );
    if (!selectedContacts.length || isImportingContacts) return;
    if (importContactsTimeoutRef.current) {
      clearTimeout(importContactsTimeoutRef.current);
      importContactsTimeoutRef.current = null;
    }
    setIsImportingContacts(true);
    setImportStatusText("");
    importContactsTimeoutRef.current = setTimeout(() => {
      onImportContacts?.(selectedContacts.map((contact) => contact.name));
      const sourceLabel =
        IMPORT_CONTACT_SOURCE_OPTIONS.find((source) => source.value === importSource)?.label ||
        "source";
      setIsImportingContacts(false);
      setImportStatusText(`Imported ${selectedContacts.length} contacts from ${sourceLabel}.`);
      importContactsTimeoutRef.current = null;
    }, 800);
  }, [
    importSource,
    importSourceContacts,
    isImportingContacts,
    onImportContacts,
    selectedImportContactIds,
  ]);

  const handleToggleImportContact = useCallback(
    (contactId) => {
      if (!contactId || isImportingContacts) return;
      setSelectedImportContactIds((prev) =>
        prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
      );
      setImportStatusText("");
    },
    [isImportingContacts]
  );

  const handleSelectManageGroup = useCallback((groupName) => {
    if (!groupName) return;
    setSelectedManageGroup(groupName);
    setManageGroupDraft(groupName);
    setManageGroupsStatusText("");
  }, []);

  const handleAddManageGroup = useCallback(() => {
    const nextGroupName = manageGroupDraft.trim();
    if (!nextGroupName) {
      setManageGroupsStatusText("Type a group name first.");
      return;
    }
    const exists = manageGroups.some(
      (groupName) => groupName.trim().toLowerCase() === nextGroupName.toLowerCase()
    );
    if (exists) {
      setManageGroupsStatusText("That group already exists.");
      return;
    }
    setManageGroups((prev) => [...prev, nextGroupName]);
    setSelectedManageGroup(nextGroupName);
    setManageGroupDraft(nextGroupName);
    setManageGroupsStatusText(`Added "${nextGroupName}".`);
  }, [manageGroupDraft, manageGroups]);

  const handleRenameManageGroup = useCallback(() => {
    const currentGroup = selectedManageGroup.trim();
    const nextGroupName = manageGroupDraft.trim();
    if (!currentGroup) {
      setManageGroupsStatusText("Select a group to rename.");
      return;
    }
    if (isSelectedManageGroupProtected) {
      setManageGroupsStatusText('"Friends" cannot be renamed.');
      return;
    }
    if (!nextGroupName) {
      setManageGroupsStatusText("Type a new group name.");
      return;
    }
    const exists = manageGroups.some(
      (groupName) =>
        groupName.trim().toLowerCase() === nextGroupName.toLowerCase() &&
        groupName.trim().toLowerCase() !== currentGroup.toLowerCase()
    );
    if (exists) {
      setManageGroupsStatusText("A group with that name already exists.");
      return;
    }
    setManageGroups((prev) =>
      prev.map((groupName) =>
        groupName.trim().toLowerCase() === currentGroup.toLowerCase() ? nextGroupName : groupName
      )
    );
    setSelectedManageGroup(nextGroupName);
    setManageGroupDraft(nextGroupName);
    setManageGroupsStatusText(`Renamed to "${nextGroupName}".`);
  }, [isSelectedManageGroupProtected, manageGroupDraft, manageGroups, selectedManageGroup]);

  const handleDeleteManageGroup = useCallback(() => {
    const currentGroup = selectedManageGroup.trim();
    if (!currentGroup) {
      setManageGroupsStatusText("Select a group to delete.");
      return;
    }
    if (isSelectedManageGroupProtected) {
      setManageGroupsStatusText('"Friends" cannot be deleted.');
      return;
    }
    const remaining = manageGroups.filter(
      (groupName) => groupName.trim().toLowerCase() !== currentGroup.toLowerCase()
    );
    const fallback = remaining[0] || DEFAULT_MANAGE_GROUPS[0];
    setManageGroups(remaining.length ? remaining : DEFAULT_MANAGE_GROUPS);
    setSelectedManageGroup(fallback);
    setManageGroupDraft(fallback);
    setManageGroupsStatusText(`Deleted "${currentGroup}".`);
  }, [isSelectedManageGroupProtected, manageGroups, selectedManageGroup]);

  const closeManageGroupsPopup = useCallback(() => {
    setManageGroupDraft(selectedManageGroup || DEFAULT_MANAGE_GROUPS[0]);
    setManageGroupsStatusText("");
    setIsManageGroupsPopupOpen(false);
  }, [selectedManageGroup]);

  const closeManageUpdates = useCallback(() => {
    setUpdatesAudienceDraft(updatesAudience);
    setBroadcastStatusDraft(broadcastStatus);
    setBroadcastDisplayImageDraft(broadcastDisplayImage);
    setBroadcastSocialDraft(broadcastSocial);
    setIsManageUpdatesOpen(false);
  }, [broadcastDisplayImage, broadcastSocial, broadcastStatus, updatesAudience]);

  const handleSaveManageUpdates = useCallback(() => {
    setUpdatesAudience(updatesAudienceDraft);
    setBroadcastStatus(broadcastStatusDraft);
    setBroadcastDisplayImage(broadcastDisplayImageDraft);
    setBroadcastSocial(broadcastSocialDraft);
    setIsManageUpdatesOpen(false);
  }, [broadcastDisplayImageDraft, broadcastSocialDraft, broadcastStatusDraft, updatesAudienceDraft]);

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

  const closeConversationHistoryPopup = useCallback(() => {
    setConversationHistorySearch("");
    setConversationHistoryStatusText("");
    setIsConversationHistoryOpen(false);
  }, []);

  const handleClearConversationHistory = useCallback(() => {
    if (!selectedContactResolved) return;
    onClearConversationHistory?.(selectedContactResolved);
    setConversationHistoryStatusText(`History with ${selectedContactResolved.name} was cleared.`);
  }, [onClearConversationHistory, selectedContactResolved]);

  useEffect(() => {
    if (!openInsiderRequestId) return;
    setIsInsiderPopupOpen(true);
  }, [openInsiderRequestId]);

  useEffect(() => {
    if (!openContactDetailsRequestId) return;
    setContactDetailsUsernameDraft(username);
    setContactDetailsStatusDraft(statusText);
    setContactDetailsPresenceDraft(presence);
    setIsConversationHistoryOpen(false);
    setIsImportContactsPopupOpen(false);
    setIsAddressBookPopupOpen(false);
    setIsManageGroupsPopupOpen(false);
    setIsSelectedContactDetailsOpen(false);
    setIsManageUpdatesOpen(false);
    setIsWebcamPopupOpen(false);
    setIsDisplayImageOpen(false);
    setIsAccountInfoOpen(false);
    setIsContactDetailsOpen(true);
    requestAnimationFrame(() => {
      const hostRect = contactDetailsHostRef.current?.getBoundingClientRect();
      const popupWidth = contactDetailsPopupRef.current?.offsetWidth || 420;
      const alignedX = (hostRect?.width || popupWidth) - popupWidth;
      setContactDetailsPosition({ x: alignedX, y: 22 });
    });
  }, [openContactDetailsRequestId]);

  useEffect(() => {
    if (!openContactProfileRequestId) return;
    if (!selectedContactResolved) return;
    setIsContactDetailsOpen(false);
    setIsContactDetailsDragging(false);
    setIsConversationHistoryOpen(false);
    setIsImportContactsPopupOpen(false);
    setIsAddressBookPopupOpen(false);
    setIsManageGroupsPopupOpen(false);
    setIsManageUpdatesOpen(false);
    setIsAccountInfoOpen(false);
    setIsDisplayImageOpen(false);
    setIsWebcamPopupOpen(false);
    setIsSelectedContactDetailsOpen(true);
  }, [openContactProfileRequestId, selectedContactResolved]);

  useEffect(() => {
    if (!openAccountInfoRequestId) return;
    setIsContactDetailsOpen(false);
    setIsContactDetailsDragging(false);
    setIsConversationHistoryOpen(false);
    setIsImportContactsPopupOpen(false);
    setIsAddressBookPopupOpen(false);
    setIsManageGroupsPopupOpen(false);
    setIsSelectedContactDetailsOpen(false);
    setIsManageUpdatesOpen(false);
    setIsWebcamPopupOpen(false);
    setIsDisplayImageOpen(false);
    setIsAccountInfoOpen(true);
  }, [openAccountInfoRequestId]);

  useEffect(() => {
    if (!openDisplayImageRequestId) return;
    setDisplayImageDraft(resolvedAvatarSrc);
    setIsContactDetailsOpen(false);
    setIsContactDetailsDragging(false);
    setIsConversationHistoryOpen(false);
    setIsImportContactsPopupOpen(false);
    setIsAddressBookPopupOpen(false);
    setIsManageGroupsPopupOpen(false);
    setIsSelectedContactDetailsOpen(false);
    setIsManageUpdatesOpen(false);
    setIsAccountInfoOpen(false);
    setIsWebcamPopupOpen(false);
    setIsDisplayImageOpen(true);
  }, [openDisplayImageRequestId]);

  useEffect(() => {
    if (!openWebcamRequestId) return;
    setIsContactDetailsOpen(false);
    setIsContactDetailsDragging(false);
    setIsConversationHistoryOpen(false);
    setIsImportContactsPopupOpen(false);
    setIsAddressBookPopupOpen(false);
    setIsManageGroupsPopupOpen(false);
    setIsSelectedContactDetailsOpen(false);
    setIsManageUpdatesOpen(false);
    setIsAccountInfoOpen(false);
    setIsDisplayImageOpen(false);
    setIsWebcamPopupOpen(true);
    requestAnimationFrame(() => {
      startWebcamPreview();
    });
  }, [openWebcamRequestId, startWebcamPreview]);

  useEffect(() => {
    if (!openManageUpdatesRequestId) return;
    setUpdatesAudienceDraft(updatesAudience);
    setBroadcastStatusDraft(broadcastStatus);
    setBroadcastDisplayImageDraft(broadcastDisplayImage);
    setBroadcastSocialDraft(broadcastSocial);
    setIsContactDetailsOpen(false);
    setIsContactDetailsDragging(false);
    setIsConversationHistoryOpen(false);
    setIsImportContactsPopupOpen(false);
    setIsAddressBookPopupOpen(false);
    setIsManageGroupsPopupOpen(false);
    setIsSelectedContactDetailsOpen(false);
    setIsAccountInfoOpen(false);
    setIsDisplayImageOpen(false);
    setIsWebcamPopupOpen(false);
    setIsManageUpdatesOpen(true);
  }, [openManageUpdatesRequestId]);

  useEffect(() => {
    if (!openAddressBookContactRequestId) return;
    setAddressBookSearch("");
    setSelectedAddressBookId(ADDRESS_BOOK_CONTACTS[0]?.id || "");
    setIsContactDetailsOpen(false);
    setIsContactDetailsDragging(false);
    setIsConversationHistoryOpen(false);
    setIsImportContactsPopupOpen(false);
    setIsManageGroupsPopupOpen(false);
    setIsSelectedContactDetailsOpen(false);
    setIsManageUpdatesOpen(false);
    setIsAccountInfoOpen(false);
    setIsDisplayImageOpen(false);
    setIsWebcamPopupOpen(false);
    setIsAddressBookPopupOpen(true);
  }, [openAddressBookContactRequestId]);

  useEffect(() => {
    if (!isAddressBookPopupOpen) return;
    if (
      filteredAddressBookContacts.some((contact) => contact.id === selectedAddressBookId)
    ) {
      return;
    }
    setSelectedAddressBookId(filteredAddressBookContacts[0]?.id || "");
  }, [filteredAddressBookContacts, isAddressBookPopupOpen, selectedAddressBookId]);

  useEffect(() => {
    if (!isManageGroupsPopupOpen) return;
    if (manageGroups.some((groupName) => groupName === selectedManageGroup)) return;
    const fallback = manageGroups[0] || DEFAULT_MANAGE_GROUPS[0];
    setSelectedManageGroup(fallback);
    setManageGroupDraft(fallback);
  }, [isManageGroupsPopupOpen, manageGroups, selectedManageGroup]);

  useEffect(() => {
    if (!isSelectedContactDetailsOpen) return;
    if (selectedContactResolved) return;
    setIsSelectedContactDetailsOpen(false);
  }, [isSelectedContactDetailsOpen, selectedContactResolved]);

  useEffect(() => {
    if (!isConversationHistoryOpen) return;
    if (selectedContactResolved) return;
    closeConversationHistoryPopup();
  }, [closeConversationHistoryPopup, isConversationHistoryOpen, selectedContactResolved]);

  useEffect(() => {
    if (!openConversationHistoryRequestId) return;
    if (openConversationHistoryRequestId === conversationHistoryRequestHandledRef.current) return;
    conversationHistoryRequestHandledRef.current = openConversationHistoryRequestId;
    if (!selectedContactResolved) return;
    setConversationHistorySearch("");
    setConversationHistoryStatusText("");
    setIsContactDetailsOpen(false);
    setIsContactDetailsDragging(false);
    setIsImportContactsPopupOpen(false);
    setIsAddressBookPopupOpen(false);
    setIsManageGroupsPopupOpen(false);
    setIsSelectedContactDetailsOpen(false);
    setIsManageUpdatesOpen(false);
    setIsAccountInfoOpen(false);
    setIsDisplayImageOpen(false);
    setIsWebcamPopupOpen(false);
    setIsConversationHistoryOpen(true);
  }, [openConversationHistoryRequestId, selectedContactResolved]);

  useEffect(() => {
    setCollapsedCustomGroups((prev) => {
      const next = {};
      customGroupNames.forEach((groupName) => {
        const groupKey = normalizeGroupName(groupName);
        next[groupKey] = prev[groupKey] ?? false;
      });
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (
        prevKeys.length === nextKeys.length &&
        prevKeys.every((groupKey) => prev[groupKey] === next[groupKey])
      ) {
        return prev;
      }
      return next;
    });
  }, [customGroupNames, normalizeGroupName]);

  useEffect(() => {
    if (!openManageGroupsRequestId) return;
    setIsContactDetailsOpen(false);
    setIsContactDetailsDragging(false);
    setIsConversationHistoryOpen(false);
    setIsImportContactsPopupOpen(false);
    setIsAddressBookPopupOpen(false);
    setIsManageGroupsPopupOpen(false);
    setIsSelectedContactDetailsOpen(false);
    setIsManageUpdatesOpen(false);
    setIsAccountInfoOpen(false);
    setIsDisplayImageOpen(false);
    setIsWebcamPopupOpen(false);
    setManageGroups((prev) => (prev.length ? prev : [...DEFAULT_MANAGE_GROUPS]));
    const nextGroup = selectedManageGroupRef.current || DEFAULT_MANAGE_GROUPS[0];
    setSelectedManageGroup(nextGroup);
    setManageGroupDraft(nextGroup);
    setManageGroupsStatusText("");
    setIsManageGroupsPopupOpen(true);
  }, [openManageGroupsRequestId]);

  useEffect(() => {
    if (!openImportContactsRequestId) return;
    if (importContactsTimeoutRef.current) {
      clearTimeout(importContactsTimeoutRef.current);
      importContactsTimeoutRef.current = null;
    }
    setImportSource("gmail");
    setSelectedImportContactIds([]);
    setImportStatusText("");
    setIsImportingContacts(false);
    setIsContactDetailsOpen(false);
    setIsContactDetailsDragging(false);
    setIsConversationHistoryOpen(false);
    setIsAddressBookPopupOpen(false);
    setIsManageGroupsPopupOpen(false);
    setIsSelectedContactDetailsOpen(false);
    setIsManageUpdatesOpen(false);
    setIsAccountInfoOpen(false);
    setIsDisplayImageOpen(false);
    setIsWebcamPopupOpen(false);
    setIsImportContactsPopupOpen(true);
  }, [openImportContactsRequestId]);

  useEffect(() => {
    if (!isImportContactsPopupOpen) return;
    setSelectedImportContactIds([]);
  }, [importSourceContacts, isImportContactsPopupOpen]);

  useEffect(() => {
    if (isImportContactsPopupOpen) return;
    if (!importContactsTimeoutRef.current) return;
    clearTimeout(importContactsTimeoutRef.current);
    importContactsTimeoutRef.current = null;
    setIsImportingContacts(false);
  }, [isImportContactsPopupOpen]);

  useEffect(() => {
    return () => {
      if (importContactsTimeoutRef.current) {
        clearTimeout(importContactsTimeoutRef.current);
        importContactsTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    isWebcamPopupOpenRef.current = isWebcamPopupOpen;
    if (isWebcamPopupOpen) return;
    webcamRequestRef.current += 1;
    stopWebcamPreview();
  }, [isWebcamPopupOpen, stopWebcamPreview]);

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
      !isContactDetailsOpen &&
      !isAccountInfoOpen &&
      !isDisplayImageOpen &&
      !isManageUpdatesOpen &&
      !isAddressBookPopupOpen &&
      !isImportContactsPopupOpen &&
      !isManageGroupsPopupOpen &&
      !isSelectedContactDetailsOpen &&
      !isConversationHistoryOpen &&
      !isWebcamPopupOpen
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
      if (accountInfoPopupRef.current?.contains(event.target)) return;
      if (displayImagePopupRef.current?.contains(event.target)) return;
      if (manageUpdatesPopupRef.current?.contains(event.target)) return;
      if (addressBookPopupRef.current?.contains(event.target)) return;
      if (importContactsPopupRef.current?.contains(event.target)) return;
      if (manageGroupsPopupRef.current?.contains(event.target)) return;
      if (selectedContactDetailsPopupRef.current?.contains(event.target)) return;
      if (conversationHistoryPopupRef.current?.contains(event.target)) return;
      if (webcamPopupRef.current?.contains(event.target)) return;
      setIsShareToMenuOpen(false);
      setIsShareEmoteOpen(false);
      setIsSharePanelOpen(false);
      setIsPresenceMenuOpen(false);
      setIsContactViewMenuOpen(false);
      setIsPhonePopupOpen(false);
      setIsInsiderPopupOpen(false);
      setIsContactDetailsOpen(false);
      setIsAccountInfoOpen(false);
      setIsDisplayImageOpen(false);
      setIsManageUpdatesOpen(false);
      setIsAddressBookPopupOpen(false);
      setIsImportContactsPopupOpen(false);
      setIsManageGroupsPopupOpen(false);
      setIsSelectedContactDetailsOpen(false);
      setIsConversationHistoryOpen(false);
      setIsWebcamPopupOpen(false);
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
    isAccountInfoOpen,
    isDisplayImageOpen,
    isManageUpdatesOpen,
    isAddressBookPopupOpen,
    isImportContactsPopupOpen,
    isManageGroupsPopupOpen,
    isSelectedContactDetailsOpen,
    isConversationHistoryOpen,
    isWebcamPopupOpen,
  ]);

  useEffect(() => {
    if (!isSharePanelOpen) {
      setIsShareEmoteOpen(false);
    }
  }, [isSharePanelOpen]);

  const handleContactSelect = (contact) => {
    onContactFocus?.(contact);
    setRecentContacts((prev) =>
      prev.some((item) => item.id === contact.id) ? prev : [contact, ...prev]
    );
    onOpenConversation?.(contact);
  };

  const recentCount = displayedRecentContacts.length;
  const recentTotalCount = normalizedRecentContacts.length;
  const friendsCount = displayedFriends.length;
  const friendsTotalCount = friendsBaseContacts.length;
  const availabilityLabel = presence === "invisible" ? "Invisible" : "Available";
  const webcamStatusMessage =
    webcamState === "live"
      ? "Webcam preview is active."
      : webcamState === "requesting"
        ? "Requesting camera access..."
        : webcamState === "error"
          ? webcamError
          : "Press Start Preview to enable webcam.";
  const selectedContactStealthLabel = selectedContactResolved
    ? (() => {
        const mode = String(stealthByContact?.[selectedContactResolved.id] || "online").toLowerCase();
        if (mode === "offline") return "Appear offline";
        if (mode === "permanent-offline") return "Appear permanently offline";
        return "Appear online";
      })()
    : "Appear online";
  const getStealthLabel = useCallback(
    (contactId) => {
      const mode = String(stealthByContact?.[contactId] || "online").toLowerCase();
      if (mode === "offline") return "appear offline";
      if (mode === "permanent-offline") return "permanently offline";
      return "";
    },
    [stealthByContact]
  );

  return (
    <div className="yahoo-signedin">
      <div className="yahoo-signedin-profile">
        <img
          src={resolvedAvatarSrc}
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
          <YahooContactDetailsPopup
            isOpen={isContactDetailsOpen}
            popupRef={contactDetailsPopupRef}
            position={contactDetailsPosition}
            usernameDraft={contactDetailsUsernameDraft}
            statusDraft={contactDetailsStatusDraft}
            presenceDraft={contactDetailsPresenceDraft}
            presenceOptions={PRESENCE_OPTIONS}
            onUsernameChange={setContactDetailsUsernameDraft}
            onStatusChange={setContactDetailsStatusDraft}
            onPresenceChange={setContactDetailsPresenceDraft}
            onSave={handleSaveContactDetails}
            onCancel={() => setIsContactDetailsOpen(false)}
            onClose={() => {
              setIsContactDetailsOpen(false);
              setIsContactDetailsDragging(false);
            }}
            onHeaderMouseDown={handleContactDetailsHeaderMouseDown}
          />
          <YahooAccountInfoPopup
            isOpen={isAccountInfoOpen}
            popupRef={accountInfoPopupRef}
            username={username}
            availabilityLabel={availabilityLabel}
            statusText={statusText}
            onManageAccount={handleOpenAccountInfoPage}
            onClose={() => setIsAccountInfoOpen(false)}
          />
          <YahooSelectedContactDetailsPopup
            isOpen={isSelectedContactDetailsOpen}
            popupRef={selectedContactDetailsPopupRef}
            contact={selectedContactResolved}
            stealthLabel={selectedContactStealthLabel}
            onSendMessage={(contact) => {
              onContactFocus?.(contact);
              onOpenConversation?.(contact);
              setIsSelectedContactDetailsOpen(false);
            }}
            onClose={() => setIsSelectedContactDetailsOpen(false)}
          />
          <YahooConversationHistoryPopup
            isOpen={isConversationHistoryOpen}
            popupRef={conversationHistoryPopupRef}
            contact={selectedContactResolved}
            searchValue={conversationHistorySearch}
            onSearchChange={(value) => {
              setConversationHistorySearch(value);
              setConversationHistoryStatusText("");
            }}
            messages={filteredConversationHistoryMessages}
            totalMessages={selectedConversationHistoryMessages.length}
            statusText={conversationHistoryStatusText}
            onOpenConversation={(contact) => {
              onContactFocus?.(contact);
              onOpenConversation?.(contact);
              setIsConversationHistoryOpen(false);
            }}
            onClearHistory={handleClearConversationHistory}
            onClose={closeConversationHistoryPopup}
          />
          <YahooDisplayImagePopup
            isOpen={isDisplayImageOpen}
            popupRef={displayImagePopupRef}
            selectedImage={displayImageDraft}
            fallbackImage={resolvedAvatarSrc}
            options={DISPLAY_IMAGE_OPTIONS}
            onSelectImage={setDisplayImageDraft}
            onSave={handleSaveDisplayImage}
            onClose={() => setIsDisplayImageOpen(false)}
          />
          <YahooManageUpdatesPopup
            isOpen={isManageUpdatesOpen}
            popupRef={manageUpdatesPopupRef}
            audience={updatesAudienceDraft}
            broadcastStatus={broadcastStatusDraft}
            broadcastDisplayImage={broadcastDisplayImageDraft}
            broadcastSocial={broadcastSocialDraft}
            onAudienceChange={setUpdatesAudienceDraft}
            onBroadcastStatusChange={setBroadcastStatusDraft}
            onBroadcastDisplayImageChange={setBroadcastDisplayImageDraft}
            onBroadcastSocialChange={setBroadcastSocialDraft}
            onSave={handleSaveManageUpdates}
            onClose={closeManageUpdates}
          />
          <YahooAddressBookPopup
            isOpen={isAddressBookPopupOpen}
            popupRef={addressBookPopupRef}
            searchValue={addressBookSearch}
            onSearchChange={setAddressBookSearch}
            contacts={filteredAddressBookContacts}
            selectedContactId={selectedAddressBookId}
            onSelectContact={setSelectedAddressBookId}
            onAdd={handleAddAddressBookContact}
            onClose={() => setIsAddressBookPopupOpen(false)}
          />
          <YahooManageGroupsPopup
            isOpen={isManageGroupsPopupOpen}
            popupRef={manageGroupsPopupRef}
            groups={manageGroupRows}
            selectedGroup={selectedManageGroup}
            draftName={manageGroupDraft}
            statusText={manageGroupsStatusText}
            canRename={!isSelectedManageGroupProtected}
            canDelete={!isSelectedManageGroupProtected}
            onSelectGroup={handleSelectManageGroup}
            onDraftNameChange={setManageGroupDraft}
            onAddGroup={handleAddManageGroup}
            onRenameGroup={handleRenameManageGroup}
            onDeleteGroup={handleDeleteManageGroup}
            onClose={closeManageGroupsPopup}
          />
          <YahooImportContactsPopup
            isOpen={isImportContactsPopupOpen}
            popupRef={importContactsPopupRef}
            source={importSource}
            sourceOptions={IMPORT_CONTACT_SOURCE_OPTIONS}
            contacts={importSourceContacts}
            selectedContactIds={selectedImportContactIds}
            isImporting={isImportingContacts}
            statusText={importStatusText}
            onSourceChange={(nextSource) => {
              setImportSource(nextSource);
              setImportStatusText("");
            }}
            onToggleContact={handleToggleImportContact}
            onImport={handleImportContacts}
            onClose={closeImportContactsPopup}
          />
          <YahooWebcamPopup
            isOpen={isWebcamPopupOpen}
            popupRef={webcamPopupRef}
            videoRef={webcamVideoRef}
            webcamState={webcamState}
            webcamStatusMessage={webcamStatusMessage}
            onStartPreview={startWebcamPreview}
            onStopPreview={stopWebcamPreview}
            onClose={() => setIsWebcamPopupOpen(false)}
          />
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
                        className={`yahoo-signedin-contact${contact.isFriend ? " friends" : ""}${
                          selectedContactId === contact.id ? " is-selected" : ""
                        }`}
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
                        <span className="yahoo-signedin-contact-name">
                          {contact.name}
                          {getStealthLabel(contact.id) ? (
                            <span className="yahoo-signedin-contact-stealth">
                              ({getStealthLabel(contact.id)})
                            </span>
                          ) : null}
                        </span>
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
                    className={`yahoo-signedin-contact${contact.isFriend ? " friends" : ""}${
                      selectedContactId === contact.id ? " is-selected" : ""
                    }`}
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
                    <span className="yahoo-signedin-contact-name">
                      {contact.name}
                      {getStealthLabel(contact.id) ? (
                        <span className="yahoo-signedin-contact-stealth">
                          ({getStealthLabel(contact.id)})
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))
              : null}
            {customGroupSections.map((groupSection) => (
              <React.Fragment key={`custom-group-${groupSection.key}`}>
                <div
                  className={`yahoo-signedin-group${
                    collapsedCustomGroups[groupSection.key] ? " is-collapsed" : ""
                  }`}
                  onClick={() =>
                    setCollapsedCustomGroups((prev) => ({
                      ...prev,
                      [groupSection.key]: !prev[groupSection.key],
                    }))
                  }
                >
                  <img
                    src={collapsedCustomGroups[groupSection.key] ? rightArrowIcon : downArrowIcon}
                    alt=""
                    className="yahoo-signedin-group-toggle"
                    draggable="false"
                    aria-hidden="true"
                  />
                  <span className="yahoo-signedin-group-title">
                    {`${groupSection.name} (${groupSection.visibleCount}/${groupSection.totalCount})`}
                  </span>
                </div>
                {!collapsedCustomGroups[groupSection.key]
                  ? groupSection.visibleContacts.map((contact) => (
                      <div
                        key={`${groupSection.key}-${contact.id}`}
                        className={`yahoo-signedin-contact${contact.isFriend ? " friends" : ""}${
                          selectedContactId === contact.id ? " is-selected" : ""
                        }`}
                        onClick={() => handleContactSelect(contact)}
                      >
                        <img
                          src={contact.icon}
                          alt={contact.name}
                          className="yahoo-signedin-contact-avatar"
                          draggable="false"
                        />
                        <span
                          className={`yahoo-signedin-contact-status${
                            contact.status === "offline" ? " is-offline" : " is-online"
                          }`}
                        />
                        <span className="yahoo-signedin-contact-name">
                          {contact.name}
                          {getStealthLabel(contact.id) ? (
                            <span className="yahoo-signedin-contact-stealth">
                              ({getStealthLabel(contact.id)})
                            </span>
                          ) : null}
                        </span>
                      </div>
                    ))
                  : null}
              </React.Fragment>
            ))}
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
