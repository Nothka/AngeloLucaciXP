import React, { useEffect, useState } from "react";
import BootScreen from "./components/boot/BootScreen";
import LoginScreen from "./components/login/LoginScreen";
import Desktop from "./components/desktop/Desktop";
import Welcome from "./components/welcome/Welcome";
import wallpaper from "./assets/xp-wallpaper.jpg";
import startIdle from "./assets/start.png";
import startHover from "./assets/start-hovered.png";
import startActive from "./assets/start-clicked.png";
import aboutIcon from "./assets/startmenu/about.png";
import myProjectsIcon from "./assets/startmenu/myprojects.png";
import contactIcon from "./assets/startmenu/contact.png";
import pdfIcon from "./assets/startmenu/Pdf.png";
import xpLogo from "./assets/xp-logo.png";
import loginAvatar from "./assets/login-avatar.png";
import restartIcon from "./assets/restart.png";
import yahooIcon from "./assets/startmenu/recentlyused/yahoo.jpeg";

const CRITICAL_ASSETS = [
  wallpaper,
  startIdle,
  startHover,
  startActive,
  aboutIcon,
  myProjectsIcon,
  contactIcon,
  pdfIcon,
  xpLogo,
  loginAvatar,
  restartIcon,
  yahooIcon,
];

const preloadImages = (sources, timeoutMs = 6000) =>
  Promise.race([
    Promise.all(
      sources.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve;
            img.src = src;
          })
      )
    ),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);

const App = () => {
  const [screen, setScreen] = useState("boot"); // "boot" | "login" | "desktop"
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    preloadImages(CRITICAL_ASSETS).then(() => {
      if (!cancelled) setAssetsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleContextMenu = (event) => {
      event.preventDefault();
    };

    const isBlockedShortcut = (event) => {
      const key = event.key?.toLowerCase();
      const isMac = navigator.platform?.toLowerCase().includes("mac");
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      if (event.key === "F12") return true;
      if (cmdOrCtrl && event.shiftKey && ["i", "j", "c"].includes(key)) return true;
      if (cmdOrCtrl && key === "u") return true;
      return false;
    };

    const handleKeyDown = (event) => {
      if (isBlockedShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, []);

  // trecere automată boot → login
  useEffect(() => {
    if (screen === "boot") {
      const t = setTimeout(() => setScreen("login"), 5000);
      return () => clearTimeout(t);
    }
  }, [screen]);

  const handleLogin = () => {
    setScreen("welcome");
  };

  const handleEnterDesktop = () => {
    if (!assetsReady) return;
    setScreen("desktop");
  };

  const handleRestartToLogin = () => {
    setScreen("boot");
  };

  const handleLogOff = () => {
    setScreen("login");
  };

  const handleShutdown = () => {
    setScreen("boot");
  };
  if (screen === "boot") return <BootScreen />;
  if (screen === "login")
    return <LoginScreen onLogin={handleLogin} onRestart={handleRestartToLogin} />;
  if (screen === "welcome")
    return <Welcome onContinue={handleEnterDesktop} isReady={assetsReady} />;

  return <Desktop onLogOff={handleLogOff} onShutdown={handleShutdown} />;
};

export default App;
