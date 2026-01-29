import React, { useEffect, useState } from "react";
import startIdle from "../../../../assets/start.png";
import startHover from "../../../../assets/start-hovered.png";
import startActive from "../../../../assets/start-clicked.png";

const StartButton = ({ className = "", onClick, isActive = false }) => {
  const [currentSrc, setCurrentSrc] = useState(startIdle);

  useEffect(() => {
    setCurrentSrc(isActive ? startActive : startIdle);
  }, [isActive]);

  const handleEnter = () => {
    if (!isActive) setCurrentSrc(startHover);
  };

  const handleLeave = () => {
    if (!isActive) setCurrentSrc(startIdle);
  };

  const handleDown = () => setCurrentSrc(startActive);
  const handleUp = () => setCurrentSrc(isActive ? startActive : startHover);
  const handleClick = () => {
    if (onClick) onClick();
  };

  return (
    <button
      className={`start-button ${className}`.trim()}
      type="button"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      onClick={handleClick}
    >
      <img src={currentSrc} alt="Start" className="start-logo" />
    </button>
  );
};

export default StartButton;
