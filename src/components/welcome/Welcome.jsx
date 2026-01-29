import React, { useEffect } from "react";
import Header from "../login/Header";
import Footer from "../login/Footer";
import { instructions, productName } from "../login/User/UserProfile";
import "../../styles/welcome/welcome.css";

const Welcome = ({ onContinue, isReady = true }) => {
  useEffect(() => {
    if (!isReady) return;
    const timer = setTimeout(() => {
      onContinue?.();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onContinue, isReady]);

  return (
    <div id="login-screen">
      <div className="login-screen">
        <Header />

        <main className="login-screen-inner">
          <div className="welcome-center">
            <span className="welcome-word">welcome</span>
          </div>
        </main>

        <Footer
          productName={productName}
          mobileInstruction={instructions.mobileFull}
          onRestart={onContinue}
        />
      </div>
    </div>
  );
};

export default Welcome;
