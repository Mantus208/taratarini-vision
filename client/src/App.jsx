import { useState, useEffect, useCallback } from "react";
import { api, getToken, setToken, onToast, toast, useFetch } from "./api";
import { NAMES } from "./utils";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Ledger from "./pages/Ledger";
import Requests from "./pages/Requests";
import Complaints from "./pages/Complaints";
import Users from "./pages/Users";
import Profile from "./pages/Profile";

export default function App() {
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(!getToken());
  const [tab, setTab] = useState(location.hash.slice(1) || "home");
  const [tmsg, setTmsg] = useState(null);

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
      toast("Session khatam, dobara login karein", true);
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
  };
  const go = (t) => {
    setTab(t);
    history.replaceState(null, "", "#" + t);
  };

  const toastEl = tmsg && (
    <div className={"toast" + (tmsg.bad ? " bad" : "")}>{tmsg.m}</div>
  );

  if (!ready) return <div className="wrap">Loading...</div>;
  if (!me)
    return (
      <>
        {<Auth onLogin={setMe} />}
        {toastEl}
      </>
    );
  if (!names) return <div className="wrap">Loading...</div>;

  const P = me.perms,
    s = sum || {};
  const tabs = [["home", "🏠 Home", 0]];
  if (P.canViewLedger || P.canAddIncome) tabs.push(["ledger", "📒 Ledger", 0]);
  if (P.canRequest || P.canApprove || P.canPurchase)
    tabs.push(["req", "💸 Requests", s.pendingForMe || 0]);
  if (P.canViewComplaints || P.canRaiseComplaint)
    tabs.push([
      "cmp",
      "🎫 Complaints",
      P.canResolve ? s.openComplaints || 0 : 0,
    ]);
  if (P.isAdmin) tabs.push(["users", "👥 Users", 0]);
  tabs.push(["me", "👤 Profile", 0]);
  const cur = tabs.some((t) => t[0] === tab) ? tab : "home";

  const pages = {
    home: <Home me={me} sum={s} />,
    ledger: <Ledger me={me} />,
    req: <Requests me={me} />,
    cmp: <Complaints me={me} />,
    users: <Users />,
    me: <Profile me={me} />,
  };

  return (
    <>
      <div className="top">
        <b>🏢 Taratarini Vision</b>
        <span>
          {me.name} &nbsp;
          <button className="btn sm gray" onClick={logout}>
            Logout
          </button>
        </span>
      </div>
      <div className="nav">
        {tabs.map((t) => (
          <button
            key={t[0]}
            className={cur === t[0] ? "on" : ""}
            onClick={() => go(t[0])}
          >
            {t[1]}
            {t[2] > 0 && <span className="badge">{t[2]}</span>}
          </button>
        ))}
      </div>
      <div className="wrap">{pages[cur]}</div>
      {toastEl}
    </>
  );
}
