import React from "react";
import closeIcon from "../../../../../assets/yahoo/header/close.webp";
import "../../../../../styles/desktop/apps/yahoo/yahoo-signedin-popups/yahoo-display-image-popup.css";

const YahooDisplayImagePopup = ({
  isOpen = false,
  popupRef,
  selectedImage,
  fallbackImage,
  options = [],
  onSelectImage,
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  const activeImage = selectedImage || fallbackImage;

  return (
    <div className="yahoo-signedin-display-image-popup" role="dialog" ref={popupRef}>
      <div className="yahoo-signedin-display-image-header">
        <div className="yahoo-signedin-display-image-title">My Display Image</div>
        <button
          type="button"
          className="yahoo-signedin-display-image-close"
          aria-label="Close"
          onClick={() => onClose?.()}
        >
          <img src={closeIcon} alt="" aria-hidden="true" />
        </button>
      </div>
      <div className="yahoo-signedin-display-image-body">
        <div className="yahoo-signedin-display-image-preview-wrap">
          <img
            src={activeImage}
            alt="Selected display"
            className="yahoo-signedin-display-image-preview"
            draggable="false"
          />
          <div className="yahoo-signedin-display-image-preview-label">Preview</div>
        </div>
        <div className="yahoo-signedin-display-image-grid">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`yahoo-signedin-display-image-option${
                activeImage === option.src ? " is-active" : ""
              }`}
              onClick={() => onSelectImage?.(option.src)}
            >
              <img src={option.src} alt={option.label} draggable="false" />
            </button>
          ))}
        </div>
        <div className="yahoo-signedin-display-image-actions">
          <button
            type="button"
            className="yahoo-signedin-display-image-btn is-primary"
            onClick={() => onSave?.()}
          >
            Save
          </button>
          <button
            type="button"
            className="yahoo-signedin-display-image-btn"
            onClick={() => onClose?.()}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default YahooDisplayImagePopup;
