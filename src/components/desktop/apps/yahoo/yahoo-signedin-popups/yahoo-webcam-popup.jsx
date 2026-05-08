import React from "react";
import closeIcon from "../../../../../assets/yahoo/header/close.webp";
import "../../../../../styles/desktop/apps/yahoo/yahoo-signedin-popups/yahoo-webcam-popup.css";

const YahooWebcamPopup = ({
  isOpen = false,
  popupRef,
  videoRef,
  webcamState = "idle",
  webcamStatusMessage = "",
  onStartPreview,
  onStopPreview,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="yahoo-signedin-webcam-popup" role="dialog" ref={popupRef}>
      <div className="yahoo-signedin-webcam-header">
        <div className="yahoo-signedin-webcam-title">My Webcam</div>
        <button
          type="button"
          className="yahoo-signedin-webcam-close"
          aria-label="Close"
          onClick={() => onClose?.()}
        >
          <img src={closeIcon} alt="" aria-hidden="true" />
        </button>
      </div>
      <div className="yahoo-signedin-webcam-body">
        <div className="yahoo-signedin-webcam-preview">
          {webcamState === "live" ? (
            <video ref={videoRef} className="yahoo-signedin-webcam-video" autoPlay playsInline muted />
          ) : (
            <div className="yahoo-signedin-webcam-placeholder">Webcam Preview</div>
          )}
        </div>
        <div className={`yahoo-signedin-webcam-message${webcamState === "error" ? " is-error" : ""}`}>
          {webcamStatusMessage}
        </div>
        <div className="yahoo-signedin-webcam-actions">
          <button
            type="button"
            className="yahoo-signedin-webcam-btn is-primary"
            onClick={() => onStartPreview?.()}
            disabled={webcamState === "requesting"}
          >
            {webcamState === "requesting" ? "Starting..." : "Start Preview"}
          </button>
          <button
            type="button"
            className="yahoo-signedin-webcam-btn"
            onClick={() => onStopPreview?.()}
            disabled={webcamState !== "live"}
          >
            Stop
          </button>
          <button type="button" className="yahoo-signedin-webcam-btn" onClick={() => onClose?.()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default YahooWebcamPopup;
