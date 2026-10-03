import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import InstallApp from "./components/InstallApp.jsx";

// Global styles
import "./styles/variables.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";

// Page styles
import "./styles/pages/home.css";
import "./styles/pages/ledger.css";
import "./styles/pages/requests.css";
import "./styles/pages/complaints.css";
import "./styles/pages/users.css";
import "./styles/pages/profile.css";

// Auth
import "./styles/auth.css";

// Responsive
import "./styles/responsive.css";
import "./styles/pwa-mobile.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
}

createRoot(document.getElementById("root")).render(
  <>
    <App />
    <InstallApp />
  </>,
);
