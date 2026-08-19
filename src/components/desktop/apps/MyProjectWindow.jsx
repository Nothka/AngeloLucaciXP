import React, { useCallback, useState, useRef, useEffect } from "react";
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
import {
  isProjectLikesFeatureReady,
  subscribeToProjectLikes,
  updateProjectLike,
} from "../../../services/projectLikes";
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

/*
 * Real project data. Drop a screenshot into assets/images/projects named after
 * the project id and it is picked up automatically by the glob above;
 * without one the tile falls back to a generated cover.
 */
const PROJECTS = [
  {
    id: "portfolio",
    title: "Portfolio Website",
    caption:
      "A responsive marketing site built for a freelance client, from layout and copy through to deployment.",
    tech: ["React", "Vite", "CSS"],
    liveUrl: "https://websiteprojectangelolucaci.netlify.app/",
    repoUrl: "",
  },
  {
    id: "applewebsite",
    title: "Apple Website",
    caption:
      "A pixel-faithful rebuild of Apple's product page, focused on layout precision and scroll behaviour.",
    tech: ["HTML", "CSS", "JavaScript"],
    liveUrl: "",
    repoUrl: "https://github.com/Nothka/AppleWebsite",
  },
];

const PROFILE = {
  handle: "angelo.lucaci",
  name: "Angelo Lucaci",
  role: "Senior Frontend Developer",
  location: "Arad, Romania",
  blurb: "Vue.js · React · REST APIs · role-based dashboards",
};

const GITHUB_USER = "Nothka";
// Matches the address on the CV. Note contactme.jsx currently uses a different one.
const CONTACT_EMAIL = "lucaciangelo@gmail.com";
const LINKEDIN_URL = "https://www.linkedin.com/in/angelo-lucaci/";
const LIKED_PROJECTS_STORAGE_KEY = "xp-react-liked-projects";

const readLikedProjectIds = () => {
  try {
    const storedIds = JSON.parse(window.localStorage.getItem(LIKED_PROJECTS_STORAGE_KEY) || "[]");
    if (!Array.isArray(storedIds)) return [];
    const projectIds = new Set(PROJECTS.map((project) => project.id));
    return storedIds.filter((id) => projectIds.has(id));
  } catch {
    return [];
  }
};

const saveLikedProjectIds = (projectIds) => {
  try {
    window.localStorage.setItem(LIKED_PROJECTS_STORAGE_KEY, JSON.stringify(projectIds));
  } catch {
    // Likes still work for this session when browser storage is unavailable.
  }
};

// Any clip dropped in this folder becomes a Reel, labelled by its filename.
const reelModules = import.meta.glob("../../../assets/videos/reels/*.{mp4,webm}", {
  eager: true,
  import: "default",
});
const REELS = Object.entries(reelModules).map(([path, src]) => {
  const file = path.split("/").pop() ?? "";
  return {
    id: file,
    src,
    label: file.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
  };
});

// A deterministic cover for projects that have no screenshot yet.
const coverFor = (project) => {
  const hues = { portfolio: 212, applewebsite: 268 };
  const hue = hues[project.id] ?? 210;
  return `linear-gradient(140deg, hsl(${hue} 68% 32%), hsl(${hue + 40} 60% 16%))`;
};

const ProjectCover = ({ project, image, className }) =>
  image ? (
    <img src={image} alt={project.title} className={className} />
  ) : (
    <div className={`${className} project-cover-fallback`} style={{ background: coverFor(project) }}>
      <span>{project.title}</span>
    </div>
  );

/* Instagram's post lightbox: media on the left, caption and actions on the right. */
const PostModal = ({
  project,
  image,
  liked,
  likes,
  isLikeSaving,
  likeError,
  onToggleLike,
  onClose,
  onOpenLink,
}) => {
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Double-tapping the media likes it and plays the heart burst, as on Instagram.
  const handleDoubleClick = () => {
    if (!liked) onToggleLike();
    setBurst(true);
    window.setTimeout(() => setBurst(false), 700);
  };

  return (
    <div className="ig-modal-backdrop" onMouseDown={onClose}>
      <div
        className="ig-modal"
        role="dialog"
        aria-label={project.title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ig-modal-media" onDoubleClick={handleDoubleClick}>
          <ProjectCover project={project} image={image} className="ig-modal-image" />
          {burst ? <span className="ig-heart-burst" aria-hidden="true" /> : null}
        </div>

        <div className="ig-modal-side">
          <header className="ig-modal-head">
            <img src={profilePhotoAsset} alt="" className="ig-modal-avatar" />
            <div>
              <strong>{PROFILE.handle}</strong>
              <span className="ig-modal-sub">{project.title}</span>
            </div>
            <button type="button" className="ig-modal-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>

          <div className="ig-modal-body">
            <p className="ig-modal-caption">
              <strong>{PROFILE.handle}</strong> {project.caption}
            </p>
            <ul className="ig-tags">
              {project.tech.map((item) => (
                <li key={item}>#{item.toLowerCase().replace(/[^a-z0-9]/g, "")}</li>
              ))}
            </ul>
          </div>

          <div className="ig-modal-actions">
            <button
              type="button"
              className={`ig-icon-btn ${liked ? "is-liked" : ""}`}
              onClick={onToggleLike}
              disabled={isLikeSaving}
              aria-pressed={liked}
              aria-label={isLikeSaving ? "Saving like" : liked ? "Unlike" : "Like"}
            >
              {liked ? "♥" : "♡"}
            </button>
            {project.liveUrl ? (
              <button type="button" className="ig-link-btn" onClick={() => onOpenLink(project.liveUrl)}>
                Visit site
              </button>
            ) : null}
            {project.repoUrl ? (
              <button type="button" className="ig-link-btn" onClick={() => onOpenLink(project.repoUrl)}>
                View code
              </button>
            ) : null}
          </div>

          <p className="ig-modal-likes">
            {likes > 0 ? `${likes} like${likes === 1 ? "" : "s"}` : "Be the first to like this"}
          </p>
          {likeError ? <p className="ig-modal-like-error">{likeError}</p> : null}
        </div>
      </div>
    </div>
  );
};

/* Full-bleed story viewer with the segmented progress bar that auto-advances. */
const StoryViewer = ({ projects, images, startIndex, onClose, onOpenLink }) => {
  const STORY_DURATION = 5000;
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  // Stamped by the timer effect on mount; reading the clock during render is impure.
  const startedRef = useRef(0);
  const project = projects[index];

  // Resetting progress here rather than in the effect keeps the timer
  // restart out of the render path.
  const goTo = useCallback((next) => {
    startedRef.current = Date.now();
    setProgress(0);
    setIndex(next);
  }, []);

  useEffect(() => {
    startedRef.current = Date.now();
    const timer = window.setInterval(() => {
      const ratio = Math.min(1, (Date.now() - startedRef.current) / STORY_DURATION);
      setProgress(ratio);
      if (ratio >= 1) {
        window.clearInterval(timer);
        if (index < projects.length - 1) goTo(index + 1);
        else onClose();
      }
    }, 40);
    return () => window.clearInterval(timer);
  }, [index, projects.length, onClose, goTo]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && index < projects.length - 1) goTo(index + 1);
      if (event.key === "ArrowLeft" && index > 0) goTo(index - 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, projects.length, onClose, goTo]);

  if (!project) return null;

  return (
    <div className="ig-story-backdrop" onMouseDown={onClose}>
      <div className="ig-story" onMouseDown={(event) => event.stopPropagation()}>
        <div className="ig-story-bars">
          {projects.map((entry, entryIndex) => (
            <span key={entry.id} className="ig-story-bar">
              <span
                className="ig-story-bar-fill"
                style={{
                  width:
                    entryIndex < index ? "100%" : entryIndex === index ? `${progress * 100}%` : "0%",
                }}
              />
            </span>
          ))}
        </div>

        <header className="ig-story-head">
          <img src={profilePhotoAsset} alt="" className="ig-modal-avatar" />
          <strong>{PROFILE.handle}</strong>
          <button type="button" className="ig-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <ProjectCover project={project} image={images[project.id]} className="ig-story-image" />

        <footer className="ig-story-foot">
          <div>
            <strong>{project.title}</strong>
            <p>{project.caption}</p>
          </div>
          {project.liveUrl || project.repoUrl ? (
            <button
              type="button"
              className="ig-link-btn"
              onClick={() => onOpenLink(project.liveUrl || project.repoUrl)}
            >
              {project.liveUrl ? "Visit site" : "View code"}
            </button>
          ) : null}
        </footer>

        {index > 0 ? (
          <button
            type="button"
            className="ig-story-nav is-prev"
            onClick={() => goTo(index - 1)}
            aria-label="Previous"
          />
        ) : null}
        {index < projects.length - 1 ? (
          <button
            type="button"
            className="ig-story-nav is-next"
            onClick={() => goTo(index + 1)}
            aria-label="Next"
          />
        ) : null}
      </div>
    </div>
  );
};

/*
 * Explore lists the repositories starred from the GitHub account — starring is
 * the curation switch, so a repo appears here the moment it is starred and
 * disappears when unstarred. Restricted to owned repos so that starring
 * somebody else's project as a bookmark never surfaces it as own work.
 *
 * The call is unauthenticated and therefore subject to GitHub's
 * 60-requests-per-hour IP limit; rate-limited and offline both fall back
 * to a link out.
 */
const GithubExplore = () => {
  const [repos, setRepos] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`https://api.github.com/users/${GITHUB_USER}/starred?per_page=100`, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((data) => {
        const owned = Array.isArray(data)
          ? data
              .filter(
                (repo) =>
                  repo.owner?.login?.toLowerCase() === GITHUB_USER.toLowerCase() && !repo.fork
              )
              .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
          : [];
        setRepos(owned);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  if (status === "loading") {
    return (
      <div className="ig-explore">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="ig-repo is-skeleton" />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="projects-empty">
        <span className="projects-empty-icon" aria-hidden="true" />
        <strong>Couldn&apos;t reach GitHub</strong>
        <p>The public API may be rate limited. Try again shortly.</p>
        <a
          className="ig-link-btn"
          href={`https://github.com/${GITHUB_USER}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open GitHub
        </a>
      </div>
    );
  }

  if (!repos.length) {
    return (
      <div className="projects-empty">
        <span className="projects-empty-icon" aria-hidden="true" />
        <strong>Nothing starred yet</strong>
        <p>Star a repository on GitHub and it shows up here.</p>
        <a
          className="ig-link-btn"
          href={`https://github.com/${GITHUB_USER}?tab=repositories`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open GitHub
        </a>
      </div>
    );
  }

  return (
    <div className="ig-explore">
      {repos.map((repo) => (
        <a
          key={repo.id}
          className="ig-repo"
          href={repo.html_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="ig-repo-name">{repo.name}</span>
          <span className="ig-repo-desc">{repo.description || "No description yet."}</span>
          <span className="ig-repo-meta">
            {repo.language ? <em>{repo.language}</em> : null}
            <span>★ {repo.stargazers_count}</span>
            <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
          </span>
        </a>
      ))}
    </div>
  );
};

/*
 * A Direct Messages thread that ends in a real contact route: sending hands the
 * typed text to the visitor's mail client, pre-addressed and pre-filled.
 */
const DirectMessages = ({ onOpenLink }) => {
  const [draft, setDraft] = useState("");
  const [thread, setThread] = useState([
    {
      id: "intro",
      from: "them",
      text: "Hey! Thanks for scrolling this far. Ask me anything about a project, or send a message and it lands in my inbox.",
    },
  ]);

  const handleSend = (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;
    setThread((previous) => [...previous, { id: `m-${previous.length}`, from: "me", text: message }]);
    setDraft("");
    const subject = encodeURIComponent("Message from your portfolio");
    const body = encodeURIComponent(message);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setThread((previous) => [
      ...previous,
      {
        id: `r-${previous.length}`,
        from: "them",
        text: "Opening your mail app now — if nothing happened, reach me at " + CONTACT_EMAIL,
      },
    ]);
  };

  return (
    <div className="ig-dm">
      <header className="ig-dm-head">
        <img src={profilePhotoAsset} alt="" className="ig-modal-avatar" />
        <div>
          <strong>{PROFILE.handle}</strong>
          <span className="ig-modal-sub">Usually replies within a day</span>
        </div>
      </header>

      <div className="ig-dm-thread">
        {thread.map((message) => (
          <p key={message.id} className={`ig-bubble is-${message.from}`}>
            {message.text}
          </p>
        ))}
      </div>

      <div className="ig-dm-quick">
        <button type="button" className="ig-link-btn" onClick={() => onOpenLink(LINKEDIN_URL)}>
          Message on LinkedIn
        </button>
        <button
          type="button"
          className="ig-link-btn is-ghost"
          onClick={() => { window.location.href = `mailto:${CONTACT_EMAIL}`; }}
        >
          {CONTACT_EMAIL}
        </button>
      </div>

      <form className="ig-dm-compose" onSubmit={handleSend}>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message..."
          aria-label="Message"
        />
        <button type="submit" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

/* Reels: vertical clips of the projects actually running. */
const ReelsGrid = ({ reels }) => {
  if (!reels.length) {
    return (
      <div className="projects-empty">
        <span className="projects-empty-icon" aria-hidden="true" />
        <strong>No Reels yet</strong>
        <p>
          Drop screen recordings into assets/videos/reels and they appear here
          automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="ig-reels">
      {reels.map((reel) => (
        <figure key={reel.id} className="ig-reel">
          <video
            src={reel.src}
            muted
            loop
            playsInline
            preload="metadata"
            onMouseEnter={(event) => event.currentTarget.play().catch(() => {})}
            onMouseLeave={(event) => event.currentTarget.pause()}
            onClick={(event) =>
              event.currentTarget.paused
                ? event.currentTarget.play().catch(() => {})
                : event.currentTarget.pause()
            }
          />
          <figcaption>{reel.label}</figcaption>
        </figure>
      ))}
    </div>
  );
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
    { label: "Home", icon: basicUiIcon, go: () => { setActiveView("profile"); setActiveTab("posts"); } },
    { label: "Search", icon: sendIcon },
    { label: "Explore", icon: bookmarkIcon, go: () => setActiveView("explore") },
    { label: "Reels", icon: videoIcon, go: () => { setActiveView("profile"); setActiveTab("reels"); } },
    { label: "Messages", icon: chatIcon, go: () => setActiveView("messages") },
    { label: "Notifications", icon: heartIcon },
    { label: "Create", icon: addIcon },
  ];
  // Screenshot per project id, when one has been added to the assets folder.
  const projectImages = PROJECTS.reduce((acc, project) => {
    acc[project.id] = localProjectAssets[project.id] || null;
    return acc;
  }, {});

  // Sidebar picks the pane; the profile tabs only apply inside the profile pane.
  const [activeView, setActiveView] = useState("profile");
  const [activeTab, setActiveTab] = useState("posts");
  const [isFollowing, setIsFollowing] = useState(false);
  const [openPostId, setOpenPostId] = useState(null);
  const [storyIndex, setStoryIndex] = useState(null);
  const [likes, setLikes] = useState(() =>
    PROJECTS.reduce((acc, project) => ({ ...acc, [project.id]: 0 }), {})
  );
  const [likedIds, setLikedIds] = useState(readLikedProjectIds);
  const [pendingLikeIds, setPendingLikeIds] = useState([]);
  const [likeError, setLikeError] = useState("");
  const pendingLikesRef = useRef(new Set());

  useEffect(() => {
    if (!isProjectLikesFeatureReady) return undefined;
    return subscribeToProjectLikes(
      PROJECTS.map((project) => project.id),
      setLikes,
      (error) => {
        console.error("Unable to load project likes:", error);
        setLikeError("Likes could not be loaded. Check the Firestore rules.");
      }
    );
  }, []);

  const toggleLike = async (projectId) => {
    if (pendingLikesRef.current.has(projectId)) return;

    const isLiked = likedIds.includes(projectId);
    const nextLikedIds = isLiked
      ? likedIds.filter((id) => id !== projectId)
      : [...likedIds, projectId];

    pendingLikesRef.current.add(projectId);
    setPendingLikeIds((previous) => [...previous, projectId]);
    setLikeError("");
    setLikedIds(nextLikedIds);
    saveLikedProjectIds(nextLikedIds);
    setLikes((previous) => ({
      ...previous,
      [projectId]: Math.max(0, (previous[projectId] ?? 0) + (isLiked ? -1 : 1)),
    }));

    if (!isProjectLikesFeatureReady) {
      pendingLikesRef.current.delete(projectId);
      setPendingLikeIds((previous) => previous.filter((id) => id !== projectId));
      return;
    }

    try {
      const savedCount = await updateProjectLike(projectId, !isLiked);
      setLikes((previous) => ({ ...previous, [projectId]: savedCount }));
    } catch (error) {
      setLikedIds(likedIds);
      saveLikedProjectIds(likedIds);
      setLikes((previous) => ({
        ...previous,
        [projectId]: Math.max(0, (previous[projectId] ?? 0) + (isLiked ? 1 : -1)),
      }));
      setLikeError("That like could not be saved. Please try again.");
      console.error("Unable to save project like:", error);
    } finally {
      pendingLikesRef.current.delete(projectId);
      setPendingLikeIds((previous) => previous.filter((id) => id !== projectId));
    }
  };

  const openPost = PROJECTS.find((project) => project.id === openPostId) || null;
  const instagramStats = {
    posts: PROJECTS.length,
    followers: 905 + (isFollowing ? 1 : 0),
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
                  <button
                    key={item.label}
                    type="button"
                    className={`projects-ig-nav-item ${
                      (item.label === "Explore" && activeView === "explore") ||
                      (item.label === "Messages" && activeView === "messages")
                        ? "is-active"
                        : ""
                    } ${item.go ? "" : "is-inert"}`}
                    onClick={item.go}
                  >
                    <span className="projects-ig-icon" aria-hidden="true">
                      <img src={item.icon} alt="" className="projects-ig-nav-icon" />
                    </span>
                    <span className="projects-ig-nav-label">{item.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={`projects-ig-nav-item ${activeView === "profile" ? "is-active" : ""}`}
                  onClick={() => setActiveView("profile")}
                >
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
              {activeView === "explore" ? <GithubExplore /> : null}
              {activeView === "messages" ? <DirectMessages onOpenLink={handleOpenLink} /> : null}

              {activeView === "profile" ? (
                <>
              <div className="projects-ig-profile">
                <div className="projects-profile-ring">
                  <span className="projects-profile-note">Note...</span>
                  <img src={profilePhoto} alt="Angelo Lucaci" className="projects-profile-photo" />
                </div>
                <div className="projects-ig-profile-info">
                  <div className="projects-ig-username-row">
                    <span className="projects-ig-username">{PROFILE.handle}</span>
                    <span className="ig-verified" title="Verified" aria-label="Verified">
                      ✓
                    </span>
                    <img src={settingIcon} alt="" className="projects-ig-settings-icon" />
                  </div>
                  <div className="projects-ig-actions">
                    <button
                      type="button"
                      className={`projects-ig-button ${isFollowing ? "" : "is-primary"}`}
                      aria-pressed={isFollowing}
                      onClick={() => setIsFollowing((previous) => !previous)}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                    <button
                      type="button"
                      className="projects-ig-button"
                      onClick={() => setActiveView("messages")}
                    >
                      Message
                    </button>
                  </div>
                  <div className="projects-ig-stats">
                    <span><strong>{instagramStats.posts}</strong> posts</span>
                    <span><strong>{instagramStats.followers}</strong> followers</span>
                    <span><strong>{instagramStats.following}</strong> following</span>
                  </div>
                  <div className="projects-ig-bio">
                    <strong>{PROFILE.name}</strong>
                    <br />
                    {PROFILE.role} · {PROFILE.location}
                    <br />
                    {PROFILE.blurb}
                  </div>
                </div>
              </div>

              <div className="projects-stories">
                {PROJECTS.map((project, index) => (
                  <button
                    key={project.id}
                    type="button"
                    className="project-story"
                    onClick={() => setStoryIndex(index)}
                  >
                    <span className="project-story-ring is-unseen">
                      <ProjectCover
                        project={project}
                        image={projectImages[project.id]}
                        className="project-story-avatar"
                      />
                    </span>
                    <span className="project-story-label">{project.title}</span>
                  </button>
                ))}
              </div>

              <div className="projects-ig-tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`projects-ig-tab ${activeTab === tab.id ? "is-active" : ""}`}
                    aria-label={tab.label}
                    aria-pressed={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.icon ? (
                      <img src={tab.icon} alt="" className="projects-ig-tab-icon" />
                    ) : (
                      <span className={`projects-ig-tab-icon ${tab.iconClass}`} aria-hidden="true" />
                    )}
                    <span className="projects-ig-tab-label">{tab.label}</span>
                  </button>
                ))}
              </div>

              {activeTab === "posts" ? (
                <div className="projects-grid">
                  {PROJECTS.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      className="project-tile"
                      onClick={() => setOpenPostId(project.id)}
                    >
                      <ProjectCover
                        project={project}
                        image={projectImages[project.id]}
                        className="project-tile-media"
                      />
                      <span className="project-tile-overlay">
                        <span className="project-tile-stat">
                          ♥ {likes[project.id] ?? 0}
                        </span>
                        <span className="project-tile-title">{project.title}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : activeTab === "reels" ? (
                <ReelsGrid reels={REELS} />
              ) : (
                <div className="projects-empty">
                  <span className="projects-empty-icon" aria-hidden="true" />
                  <strong>No saved posts yet</strong>
                  <p>Everything lives under Posts for now.</p>
                </div>
              )}
                </>
              ) : null}
            </main>
          </div>

          {openPost ? (
            <PostModal
              project={openPost}
              image={projectImages[openPost.id]}
              liked={likedIds.includes(openPost.id)}
              likes={likes[openPost.id] ?? 0}
              isLikeSaving={pendingLikeIds.includes(openPost.id)}
              likeError={likeError}
              onToggleLike={() => toggleLike(openPost.id)}
              onClose={() => setOpenPostId(null)}
              onOpenLink={handleOpenLink}
            />
          ) : null}

          {storyIndex !== null ? (
            <StoryViewer
              projects={PROJECTS}
              images={projectImages}
              startIndex={storyIndex}
              onClose={() => setStoryIndex(null)}
              onOpenLink={handleOpenLink}
            />
          ) : null}
        </div>
      )}
      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default MyProjectWindow;
