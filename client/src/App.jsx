import { useState, useEffect, useCallback } from "react";
import { api, getToken, setToken, onToast, toast, useFetch } from "./api";
import { NAMES } from "./utils";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Ledger from "./pages/Ledger";
import Requests from "./pages/Requests";
import Complaints from "./pages/Complaints";
import Activity from "./pages/Activity";
import Users from "./pages/Users";
import Profile from "./pages/Profile";

export default function App() {
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(!getToken());
  const [tab, setTab] = useState(location.hash.slice(1) || "home");
  const [tmsg, setTmsg] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    onToast((m, bad) => {
      setTmsg({ m, bad });
      clearTimeout(window.__tt);
      window.__tt = setTimeout(() => setTmsg(null), 3500);
    });
  }, []);

  const loadMe = useCallback(async () => {
    try {
      setMe((await api("/auth/me")).user);
    } catch {
      setMe(null);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (getToken()) loadMe();
  }, [loadMe]);

  useEffect(() => {
    const f = () => {
      setMe(null);
      toast("Your session has expired. Please log in again.", true);
    };
    window.addEventListener("ao-logout", f);
    return () => window.removeEventListener("ao-logout", f);
  }, []);

  const names = useFetch("/names", !!me);
  const sum = useFetch("/summary", !!me);
  if (names) Object.assign(NAMES, names);

  const logout = () => {
    setToken("");
    setMe(null);
    setTab("home");
    setOpen(false);
  };
  const go = (t) => {
    setTab(t);
    history.replaceState(null, "", "#" + t);
    setOpen(false);
    window.scrollTo(0, 0);
  };

  const toastEl = tmsg && (
    <div className={"toast" + (tmsg.bad ? " bad" : "")}>{tmsg.m}</div>
  );

  if (!ready) return <div className="wrap">Loading...</div>;
  if (!me)
    return (
      <div className="authbg">
        <Auth onLogin={setMe} />
        {toastEl}
      </div>
    );
  if (!names) return <div className="wrap">Loading...</div>;

  const P = me.perms,
    s = sum || {};
  const tabs = [{ id: "home", ic: "🏠", label: "Home" }];
  if (P.canViewLedger || P.canAddIncome)
    tabs.push({ id: "ledger", ic: "📒", label: "Ledger" });
  if (P.canRequest || P.canApprove || P.canPurchase)
    tabs.push({
      id: "req",
      ic: "💸",
      label: "Requests",
      badge: s.pendingForMe || 0,
    });
  if (P.canViewComplaints || P.canRaiseComplaint)
    tabs.push({
      id: "cmp",
      ic: "🎫",
      label: "Complaints",
      badge: P.canResolve ? s.openComplaints || 0 : 0,
    });
  if (P.canViewActivity)
    tabs.push({ id: "activity", ic: "🕘", label: "Activity Log" });
  if (P.isAdmin) tabs.push({ id: "users", ic: "👥", label: "Users" });
  tabs.push({ id: "me", ic: "👤", label: "Profile" });
  const cur = tabs.some((t) => t.id === tab) ? tab : "home";
  const curTab = tabs.find((t) => t.id === cur);

  const pages = {
    home: <Home me={me} sum={s} go={go} />,
    ledger: <Ledger me={me} />,
    req: <Requests me={me} />,
    cmp: <Complaints me={me} />,
    activity: <Activity />,
    users: <Users />,
    me: <Profile me={me} />,
  };

  const role = P.isAdmin ? "Admin" : P.canApprove ? "Partner" : "Staff";
  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="shell">
      {/* ================= SIDEBAR ================= */}
      <aside className={"side" + (open ? " open" : "")}>
        <div className="brand">
          <div className="logo">🏢</div>

          <div>
            <div>Taratarini Vision</div>
            <small>OFFICE MANAGER</small>
          </div>
        </div>

        <nav className="navlist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={"navitem" + (cur === t.id ? " on" : "")}
              onClick={() => go(t.id)}
            >
              <span className="ic">{t.ic}</span>

              <span className="lbl">{t.label}</span>

              {t.badge > 0 && <span className="badge">{t.badge}</span>}
            </button>
          ))}
        </nav>

        {/* USER AREA */}
        <div className="userbox">
          <div className="avatar">
            {(me.name || "?").trim().charAt(0).toUpperCase()}
          </div>

          <div className="who">
            <b>{me.name}</b>
            <span>{role}</span>
          </div>

          <button type="button" className="out-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      {/* MOBILE OVERLAY */}
      <div
        className={"overlay" + (open ? " show" : "")}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* ================= MAIN ================= */}
      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="menu-btn"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>

          <h2>
            <span>{curTab.ic}</span>
            <span>{curTab.label}</span>
          </h2>

          <span className="date">{dateStr}</span>
        </header>

        <main className="wrap">{pages[cur]}</main>
      </div>

      {toastEl}
    </div>
  );
}
