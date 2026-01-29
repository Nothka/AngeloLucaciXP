import React, { useEffect, useState } from "react";
import BootScreen from "./components/boot/BootScreen";
import LoginScreen from "./components/login/LoginScreen";
import Desktop from "./components/desktop/Desktop";
import Welcome from "./components/welcome/Welcome";

const App = () => {
  const [screen, setScreen] = useState("boot"); // "boot" | "login" | "desktop"

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
    return <Welcome onContinue={handleEnterDesktop} />;

  return <Desktop onLogOff={handleLogOff} onShutdown={handleShutdown} />;
};

export default App;
