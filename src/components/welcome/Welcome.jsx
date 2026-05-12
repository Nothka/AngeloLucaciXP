import React, { useEffect } from "react";
import Header from "../login/Header";
import Footer from "../login/Footer";
import { instructions, productName } from "../login/User/UserProfile";
import shutdownSound from "../../assets/audio/windows-shutdown.mp3";
import startupSound from "../../assets/audio/xp-startup.wav";
import balloonSound from "../../assets/audio/balloon.mp3";
import "../../styles/welcome/welcome.css";

const preloadAudio = (sources, timeoutMs = 4000) =>
  Promise.all(
    Array.from(new Set(sources)).map(
      (src) =>
        new Promise((resolve) => {
          const audio = new Audio();
          const finish = () => {
            audio.removeEventListener("canplaythrough", finish);
            audio.removeEventListener("error", finish);
            resolve();
          };
          audio.preload = "auto";
          audio.addEventListener("canplaythrough", finish, { once: true });
          audio.addEventListener("error", finish, { once: true });
          audio.src = src;
          audio.load();
          setTimeout(finish, timeoutMs);
        })
    )
  );

const Welcome = ({ onContinue, isReady = true }) => {
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    const preload = preloadAudio([shutdownSound, startupSound, balloonSound]);
    const fallback = new Promise((resolve) => setTimeout(resolve, 4000));
    Promise.race([preload, fallback]).then(() => {
      if (!cancelled) onContinue?.();
    });
    return () => {
      cancelled = true;
    };
  }, [onContinue, isReady]);

  return (
    <div id="login-screen">
      <div className="login-screen">
        <Header />

        <main className="login-screen-inner">
          <div className="welcome-center">
            <span className="welcome-word">welcome</span>
            {!isReady ? <span className="welcome-loading">Loading desktop...</span> : null}
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
