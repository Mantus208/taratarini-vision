import { useEffect, useRef, useState } from "react";

export default function InstallApp() {
  const deferredPrompt = useRef(null);

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  const [canInstall, setCanInstall] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const beforeInstallHandler = (e) => {
      console.log("PWA: beforeinstallprompt fired");

      e.preventDefault();

      deferredPrompt.current = e;
      setCanInstall(true);
    };

    const installedHandler = () => {
      console.log("PWA: app installed");

      deferredPrompt.current = null;
      setCanInstall(false);
      setInstalling(false);
    };

    window.addEventListener("beforeinstallprompt", beforeInstallHandler);

    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstallHandler);

      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const install = async () => {
    const promptEvent = deferredPrompt.current;

    if (!promptEvent) {
      console.log("PWA: install prompt not available");
      return;
    }

    try {
      setInstalling(true);

      await promptEvent.prompt();

      const result = await promptEvent.userChoice;

      console.log("PWA install result:", result.outcome);

      deferredPrompt.current = null;
      setCanInstall(false);
    } catch (error) {
      console.error("PWA install error:", error);
    } finally {
      setInstalling(false);
    }
  };

  // Already running as installed PWA
  if (isStandalone) {
    return null;
  }

  // Browser has not provided install prompt
  if (!canInstall) {
    return null;
  }

  return (
    <button
      type="button"
      className="install-app-btn"
      onClick={install}
      disabled={installing}
      aria-label="Install Taratarini Vision app"
    >
      <span className="install-app-icon">📲</span>

      <span>{installing ? "Installing..." : "Install App"}</span>
    </button>
  );
}
