import React from "react";
import xpLogo from "../../assets/logos/xp-logo.webp";
import { fullName, instructions, userProfile } from "../login/User/UserProfile";

const BrandPanel = ({
  name = fullName,
  role = userProfile.role,
  xpSuffix = userProfile.xpSuffix,
  instructionDesktop = instructions.desktop,
  instructionMobile = instructions.mobile,
  instructionAction = instructions.action,
  showInstructions = true,
  className = "",
}) => {
  return (
    <div className={`left ${className}`.trim()}>
      <div className="xp-logo-lockup">
        <img src={xpLogo} alt="Windows XP style logo" className="xp-logo-image" />
        <div className="xp-wordmark-block">
          <div className="xp-wordmark">
            <span className="xp-wordmark-name">{name}</span>
            <span className="xp-wordmark-xp">{xpSuffix}</span>
          </div>
          <div className="xp-wordmark-role">{role}</div>
        </div>
      </div>

      {showInstructions && (
        <div className="left-text">
          <span className="desktop-login-instruction">
            {instructionDesktop} <span className="login-instruction-name">{fullName}</span> {instructionAction}
          </span>
          <span className="mobile-login-instruction">
            {instructionMobile} <span className="login-instruction-name">{fullName}</span> {instructionAction}
          </span>
        </div>
      )}
    </div>
  );
};

export default BrandPanel;
