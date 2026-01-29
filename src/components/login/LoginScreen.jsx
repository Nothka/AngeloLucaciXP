import React, { useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import ShutdownModal from "./ShutdownModal";
import LoginBrand from "./LoginBrand";
import LoginUserTile from "./LoginUserTile";
import { fullName, instructions, productName, userProfile } from "../login/User/UserProfile";

const LoginScreen = ({ onLogin, onRestart }) => {
  const [showShutdown, setShowShutdown] = useState(false);

  return (
    <div id="login-screen" className={showShutdown ? "login-screen--shutdown" : ""}>
      <div className="login-screen login-screen-initial-display">
        <Header />

        <main className="login-screen-inner">
          <div className="login-screen-center">
            <LoginBrand
              userName={fullName}
              role={userProfile.role}
              xpSuffix={userProfile.xpSuffix}
              instructionDesktop={instructions.desktop}
              instructionMobile={instructions.mobile}
              instructionAction={instructions.action}
            />
            <hr className="login-separator mobile-only" />
            <div className="login-divider" aria-hidden="true" />
            <LoginUserTile
              onLogin={onLogin}
              userName={userProfile.firstName}
              userRole={userProfile.role}
            />
          </div>
        </main>

      <Footer
        productName={productName}
        mobileInstruction={instructions.mobileFull}
        onRestart={() => setShowShutdown(true)}
      />
      </div>

      <div className="welcome-message welcome-message-initial-hidden">
        <span className="welcome-image-fallback">welcome</span>
      </div>

      {showShutdown && (
        <ShutdownModal
          productName={productName}
          onClose={() => setShowShutdown(false)}
          onRestart={() => {
            setShowShutdown(false);
            onRestart?.();
          }}
        />
      )}
    </div>
  );
};

export default LoginScreen;
