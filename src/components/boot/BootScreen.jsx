import React from "react";
import BrandPanel from "../login/BrandPanel";
import { fullName, userProfile } from "../login/User/UserProfile";

const BootScreen = () => {
  return (
    <div className="boot-body">
      <div className="boot-screen">
        <BrandPanel
          className="boot-brand"
          name={fullName}
          role={userProfile.role}
          xpSuffix={userProfile.xpSuffix}
          showInstructions={false}
        />

        <div className="boot-bar" aria-label="Loading">
          <div className="boot-bar-track">
            <div className="boot-bar-fill" aria-hidden="true">
              <span className="boot-bar-block" />
              <span className="boot-bar-block" />
              <span className="boot-bar-block" />
            </div>
          </div>
        </div>
      </div>

      <div className="boot-footnote">
        <span>For the best experience</span>
        <span>Enter Full Screen (F11)</span>
      </div>
    </div>
  );
};

export default BootScreen;
