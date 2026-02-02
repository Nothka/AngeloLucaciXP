import React, { useEffect, useState } from "react";
import BootScreen from "./components/boot/BootScreen";
import LoginScreen from "./components/login/LoginScreen";
import Desktop from "./components/desktop/Desktop";
import Welcome from "./components/welcome/Welcome";
import xpLogo from "./assets/xp-logo.webp";
import loginAvatar from "./assets/login-avatar.webp";
import restartIcon from "./assets/restart.png";
import wallpaper from "./assets/xp-wallpaper.webp";
import startIdle from "./assets/start.png";
import startHover from "./assets/start-hovered.png";
import startActive from "./assets/start-clicked.png";
import aboutIcon from "./assets/startmenu/about.webp";
import myProjectsIcon from "./assets/startmenu/myprojects.webp";
import contactIcon from "./assets/startmenu/contact.webp";
import pdfIcon from "./assets/startmenu/Pdf.png";
import trayIcon from "./assets/976.ico";
import securityOkIcon from "./assets/securityok.webp";
import welcomeIcon from "./assets/welcome.webp";

const ABOVE_FOLD_ASSETS = [xpLogo, loginAvatar, restartIcon];
const DESKTOP_CORE_ASSETS = [
  wallpaper,
  startIdle,
  startHover,
  startActive,
  aboutIcon,
  myProjectsIcon,
  contactIcon,
  pdfIcon,
  trayIcon,
  securityOkIcon,
  welcomeIcon,
];

const IMAGE_GLOBS = import.meta.glob("./assets/**/*.{png,jpg,jpeg,webp,gif,ico,svg}", {
  eager: true,
  as: "url",
});
const AUDIO_GLOBS = import.meta.glob("./assets/**/*.{mp3,wav,ogg}", {
  eager: true,
  as: "url",
});

const ALL_IMAGE_ASSETS = Object.values(IMAGE_GLOBS);
const ALL_AUDIO_ASSETS = Object.values(AUDIO_GLOBS);

const preloadImages = (sources) =>
  Promise.all(
    Array.from(new Set(sources)).map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve;
          img.src = src;
        })
    )
  );

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

const App = () => {
  const [screen, setScreen] = useState("boot"); // "boot" | "login" | "desktop"
  const [desktopCoreReady, setDesktopCoreReady] = useState(false);
  const [allAssetsReady, setAllAssetsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const preload = preloadImages(ABOVE_FOLD_ASSETS);
    const fallback = new Promise((resolve) => setTimeout(resolve, 3000));
    Promise.race([preload, fallback]).then(() => {
      if (!cancelled) {
        // no-op: above-the-fold assets are ready
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (desktopCoreReady) return;
    let cancelled = false;
    const preload = preloadImages(DESKTOP_CORE_ASSETS);
    const fallback = new Promise((resolve) => setTimeout(resolve, 7000));
    Promise.race([preload, fallback]).then(() => {
      if (!cancelled) setDesktopCoreReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [desktopCoreReady]);

  useEffect(() => {
    if (screen !== "desktop" || allAssetsReady) return;
    let cancelled = false;
    const preload = Promise.all([
      preloadImages(ALL_IMAGE_ASSETS),
      preloadAudio(ALL_AUDIO_ASSETS),
    ]);
    const fallback = new Promise((resolve) => setTimeout(resolve, 15000));
    Promise.race([preload, fallback]).then(() => {
      if (!cancelled) setAllAssetsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [screen, allAssetsReady]);

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
    if (!desktopCoreReady) return;
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
  if (screen === "boot") return <BootScreen isReady={desktopCoreReady} />;
  if (screen === "login")
    return <LoginScreen onLogin={handleLogin} onRestart={handleRestartToLogin} />;
  if (screen === "welcome")
    return <Welcome onContinue={handleEnterDesktop} isReady={desktopCoreReady} />;

  return <Desktop onLogOff={handleLogOff} onShutdown={handleShutdown} />;
};

export default App;
