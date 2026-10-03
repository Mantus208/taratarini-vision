import { useEffect, useState } from "react";

export default function InstallApp() {
  const [prompt, setPrompt] = useState(null);

  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true,
  );

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
    };

    const installedHandler = () => {
      setInstalled(true);
      setPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);

      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;

    prompt.prompt();

    try {
      await prompt.userChoice;
    } catch {
      // User dismissed the install prompt.
    }

    setPrompt(null);
  };

  if (installed || !prompt) {
    return null;
  }

  return (
    <button
      type="button"
      className="install-app-btn"
      onClick={install}
      aria-label="Install Taratarini Vision app"
    >
      <span className="install-app-icon">📲</span>
      <span>Install App</span>
    </button>
  );
}
