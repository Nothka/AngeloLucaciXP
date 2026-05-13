import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import feedbackIcon from "../../../assets/icons/apps/feedback.png";
import minimizeIcon from "../../../assets/icons/ui/window-controls/Minimize.webp";
import maximizeIcon from "../../../assets/icons/ui/window-controls/Maximize.webp";
import closeIcon from "../../../assets/icons/ui/window-controls/Exit.webp";
import ResizeHandles from "../ResizeHandles";
import useWindowResize from "../hooks/useWindowResize";
import { getDesktopPoint } from "../utils/desktopTransform";
import {
  COMMENT_MAX_LENGTH,
  createReview,
  fetchRecentReviews,
  getReviewsSetupMessage,
  isReviewsFeatureReady,
} from "../../../services/reviews";
import "../../../styles/desktop/window.css";
import "../../../styles/desktop/apps/feedback.css";

const DEFAULT_SIZE = { width: 760, height: 520 };
const DEFAULT_POSITION = { x: 130, y: 95 };
const DEFAULT_NAME = "Guest";
const DEFAULT_RATING = 5;
const RATING_OPTIONS = [5, 4, 3, 2, 1];
const RATING_LABELS = {
  5: "Excellent",
  4: "Great",
  3: "Good",
  2: "Fair",
  1: "Poor",
};

const formatReviewDate = (date) => {
  if (!(date instanceof Date)) return "Just now";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toStars = (rating) => {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  return "★".repeat(safeRating) + "☆".repeat(5 - safeRating);
};

const FeedbackWindow = ({
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
  const [menuOpen, setMenuOpen] = useState(null);
  const [name, setName] = useState(DEFAULT_NAME);
  const [rating, setRating] = useState(DEFAULT_RATING);
  const [ratingDropdownOpen, setRatingDropdownOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showStatusBar, setShowStatusBar] = useState(true);
  const windowRef = useRef(null);
  const ratingDropdownRef = useRef(null);
  const commentRef = useRef(null);
  const originalPosition = useRef(DEFAULT_POSITION);
  const originalSize = useRef(DEFAULT_SIZE);
  const dragOffset = useRef({ x: 0, y: 0 });
  const { startResize } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 560,
    minHeight: 360,
    isMaximized,
    onFocus: () => onMouseDown(windowId),
  });

  const reviewsEnabled = isReviewsFeatureReady;
  const averageRating = useMemo(() => {
    if (!reviews.length) return null;
    const total = reviews.reduce((acc, entry) => acc + (Number(entry.rating) || 0), 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  const focusComment = () => {
    commentRef.current?.focus();
  };

  const loadReviews = useCallback(async () => {
    setStatusMessage("");
    setErrorMessage("");
    if (!reviewsEnabled) {
      setReviews([]);
      setErrorMessage(getReviewsSetupMessage());
      return;
    }
    setIsLoading(true);
    try {
      const items = await fetchRecentReviews(30);
      setReviews(items);
      if (!items.length) {
        setStatusMessage("No feedback yet. Be the first one.");
      } else {
        setStatusMessage("Latest feedback loaded.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load feedback.");
    } finally {
      setIsLoading(false);
    }
  }, [reviewsEnabled]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadReviews();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadReviews]);

  const handleSubmit = async () => {
    setStatusMessage("");
    setErrorMessage("");
    if (!reviewsEnabled) {
      setErrorMessage(getReviewsSetupMessage());
      return;
    }
    setIsSubmitting(true);
    try {
      await createReview({ name, rating, comment });
      setComment("");
      setStatusMessage("Thanks. Your feedback was saved.");
      await loadReviews();
      focusComment();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save feedback.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeMenuAction = (action) => {
    setMenuOpen(null);
    action?.();
  };

  const handleCloseRequest = () => {
    onClose(windowId);
  };

  const toggleMaximize = () => {
    setIsMaximized((prev) => {
      if (!prev) {
        originalPosition.current = position;
        originalSize.current = size;
        setPosition({ x: 0, y: 0 });
        setSize({ width: window.innerWidth, height: window.innerHeight - 30 });
      } else {
        setPosition(originalPosition.current);
        setSize(originalSize.current);
      }
      return !prev;
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

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!windowRef.current?.contains(event.target)) {
        setMenuOpen(null);
      }
      if (!ratingDropdownRef.current?.contains(event.target)) {
        setRatingDropdownOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(null);
        setRatingDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleCommentKeyDown = (event) => {
    const key = event.key.toLowerCase();
    const cmdOrCtrl = event.metaKey || event.ctrlKey;
    if (cmdOrCtrl && key === "enter") {
      event.preventDefault();
      if (!isSubmitting) {
        handleSubmit();
      }
      return;
    }
    if (cmdOrCtrl && key === "r") {
      event.preventDefault();
      if (!isLoading) {
        loadReviews();
      }
    }
  };

  const hasSetupError = !reviewsEnabled;
  const statusBarText = hasSetupError
    ? "Firestore setup required"
    : isSubmitting
      ? "Saving feedback..."
      : isLoading
        ? "Loading feedback..."
        : "Ready";
  const ratingDisplay = `${rating} - ${RATING_LABELS[rating]}`;

  return (
    <div
      className={`window feedback-window ${isActive ? "" : "is-inactive"} ${isMaximized ? "maximized" : ""}`}
      ref={windowRef}
      style={{ top: position.y, left: position.x, zIndex, width: size.width, height: size.height }}
      onMouseDown={() => onMouseDown(windowId)}
    >
      <div className="window-header" onMouseDown={handleMouseDown} onDoubleClick={toggleMaximize}>
        <div className="window-title">
          <img src={feedbackIcon} alt="Feedback" className="window-title-icon" />
          <span>Website Feedback</span>
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

      <div className="window-menu-bar feedback-menu-bar">
        <div className="feedback-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn feedback-menu-trigger ${menuOpen === "file" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "file" ? null : "file"))}
          >
            File
          </button>
          {menuOpen === "file" ? (
            <div className="feedback-menu">
              <button type="button" className="feedback-menu-item" onClick={() => executeMenuAction(handleSubmit)}>
                Submit Review
                <span className="feedback-shortcut">Ctrl+Enter</span>
              </button>
              <button type="button" className="feedback-menu-item" onClick={() => executeMenuAction(loadReviews)}>
                Refresh
                <span className="feedback-shortcut">Ctrl+R</span>
              </button>
              <div className="feedback-menu-divider" />
              <button
                type="button"
                className="feedback-menu-item"
                onClick={() => executeMenuAction(handleCloseRequest)}
              >
                Exit
              </button>
            </div>
          ) : null}
        </div>

        <div className="feedback-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn feedback-menu-trigger ${menuOpen === "view" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "view" ? null : "view"))}
          >
            View
          </button>
          {menuOpen === "view" ? (
            <div className="feedback-menu">
              <button type="button" className="feedback-menu-item" onClick={() => executeMenuAction(loadReviews)}>
                Refresh Reviews
              </button>
              <button
                type="button"
                className="feedback-menu-item"
                onClick={() => executeMenuAction(() => setShowStatusBar((prev) => !prev))}
              >
                {showStatusBar ? "✓ " : ""}
                Status Bar
              </button>
            </div>
          ) : null}
        </div>

        <div className="feedback-menu-wrapper">
          <button
            type="button"
            className={`window-menu-btn feedback-menu-trigger ${menuOpen === "help" ? "is-open" : ""}`}
            onClick={() => setMenuOpen((prev) => (prev === "help" ? null : "help"))}
          >
            Help
          </button>
          {menuOpen === "help" ? (
            <div className="feedback-menu">
              <button
                type="button"
                className="feedback-menu-item"
                onClick={() =>
                  executeMenuAction(() =>
                    window.alert(
                      "Feedback app\n\nWrite your name, rating, and comment to leave feedback.\nData is stored in Firebase Firestore."
                    )
                  )
                }
              >
                About Feedback
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="feedback-content">
        <section className="feedback-form-panel">
          <h3>Leave a Review</h3>
          <label className="feedback-label" htmlFor="feedback-name">
            Name
          </label>
          <input
            id="feedback-name"
            className="feedback-input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            spellCheck={false}
          />

          <span className="feedback-label" id="feedback-rating-label">
            Rating
          </span>
          <div className="feedback-rating-row" role="radiogroup" aria-labelledby="feedback-rating-label">
            <div className="feedback-rating-dropdown" ref={ratingDropdownRef}>
              <button
                type="button"
                className={`feedback-rating-toggle ${ratingDropdownOpen ? "is-open" : ""}`}
                onClick={() => setRatingDropdownOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={ratingDropdownOpen}
              >
                <span>{ratingDisplay}</span>
                <span className="feedback-rating-caret" aria-hidden="true">
                  ▼
                </span>
              </button>
              {ratingDropdownOpen ? (
                <div className="feedback-rating-menu" role="listbox" aria-label="Rating options">
                  {RATING_OPTIONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`feedback-rating-option ${rating === value ? "is-selected" : ""}`}
                      onClick={() => {
                        setRating(value);
                        setRatingDropdownOpen(false);
                      }}
                      role="option"
                      aria-selected={rating === value}
                    >
                      <span>{`${value} - ${RATING_LABELS[value]}`}</span>
                      <span className="feedback-rating-option-stars">{toStars(value)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <span className="feedback-stars">{toStars(rating)}</span>
          </div>

          <label className="feedback-label" htmlFor="feedback-comment">
            Comment
          </label>
          <textarea
            id="feedback-comment"
            ref={commentRef}
            className="feedback-textarea"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            onKeyDown={handleCommentKeyDown}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder="Share your opinion about this website..."
            spellCheck={false}
          />
          <div className="feedback-counter">{`${comment.length}/${COMMENT_MAX_LENGTH}`}</div>

          <div className="feedback-actions">
            <button
              type="button"
              className="feedback-button"
              onClick={handleSubmit}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? "Saving..." : "Submit"}
            </button>
            <button
              type="button"
              className="feedback-button feedback-button--secondary"
              onClick={loadReviews}
              disabled={isLoading}
            >
              Refresh
            </button>
          </div>
          {statusMessage ? <p className="feedback-message">{statusMessage}</p> : null}
          {errorMessage ? <p className="feedback-error">{errorMessage}</p> : null}
        </section>

        <section className="feedback-list-panel">
          <div className="feedback-list-header">
            <h3>Recent Reviews</h3>
            {averageRating ? <span>{`Avg ${averageRating}/5`}</span> : null}
          </div>
          <div className="feedback-list">
            {reviews.map((entry) => (
              <article key={entry.id} className="feedback-item">
                <header className="feedback-item-header">
                  <strong>{entry.name}</strong>
                  <span>{toStars(entry.rating)}</span>
                </header>
                <p>{entry.comment}</p>
                <time>{formatReviewDate(entry.createdAt)}</time>
              </article>
            ))}
            {!reviews.length && !isLoading ? (
              <p className="feedback-empty">No reviews to display.</p>
            ) : null}
          </div>
        </section>
      </div>

      {showStatusBar ? (
        <div className="feedback-statusbar">
          <span>{statusBarText}</span>
          <span>{reviewsEnabled ? "Firebase Connected" : "Offline Mode"}</span>
        </div>
      ) : null}

      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default FeedbackWindow;
